import fs from "fs";
import path from "path";


const root = ".";
const state = { categoryFoldersMade: false }
const categories = {
    images: [
        ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp", ".tiff", ".ico",
        ".raw", ".heic", ".ai", ".psd", ".eps"
    ],
    documents: [
        ".pdf", ".doc", ".docx", ".txt", ".xls", ".xlsx", ".ppt", ".pptx", ".ods",
        ".odt", ".rtf", ".csv", ".json", ".geojson", ".xml", ".md", ".tex", ".epub"
    ],
    programs: [".exe", ".msi", ".dmg", ".pkg", ".app", ".deb", ".rpm", ".bin", ".sh", ".bat", ".cmd"],
    tunnels: [".ovpn", ".conf", ".wireguard", ".crt", ".key", ".pem", ".p12"],
    audio: [".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a", ".wma", ".aiff", ".opus"],
    video: [".mp4", ".avi", ".mkv", ".mov", ".webm", ".flv", ".vob", ".wmv", ".m4v", ".3gp"],
    archives: [".zip", ".rar", ".tar", ".gz", ".7z", ".bz2", ".xz", ".iso", ".dmg", ".jar"],
    code: [
        ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".cpp", ".c", ".cs", ".h",
        ".html", ".css", ".scss", ".php", ".go", ".rs", ".rb", ".sql", ".yaml", ".yml"
    ],
    fonts: [".ttf", ".otf", ".woff", ".woff2", ".eot"],
    database: [".db", ".sqlite", ".sqlite3", ".mdb", ".accdb", ".sql"],
    others: [/* anything else (files and folders) */],
};
const directory = new Map([["files", new Set()], ["folders", new Set()]]);

// extending map prototype to clear both sets at once
directory.clear = () => { directory.get("files").clear(); directory.get("folders").clear() }

// add to this to exclude any files or folders from being categorised
const whitelist = ["service.js", "runtime.log", ...Object.keys(categories)];

function getDirectoryFiles() {
    directory.clear();
    return new Promise((resolve, reject) => {
        fs.readdir(root, { withFileTypes: true }, (err, files) => {
            if (err) writeLog(`Error reading directory: ${err}`).then(() => reject(null));
            files.filter(dir => dir.isDirectory()).forEach(dir => directory.get("folders").add(dir.name));
            files.filter(dir => dir.isFile()).forEach(dir => directory.get("files").add(dir.name));
            resolve(directory)
        });
    });
}

function createCategoryFolders() {
    Promise
        .all(Object.keys(categories).map(category => {
            return new Promise((resolve) => {
                const categoryPath = path.join(root, category);
                fs.access(categoryPath, fs.constants.F_OK, err => err && fs.mkdir(categoryPath, async (err) => resolve(await writeLog(err ? `Error creating folder: ${err}` : `Created folder: ${category}/`))));
            });
        }))
        .then(() => {
            if (!state.categoryFoldersMade) writeLog("Category folders created").then(() => state.categoryFoldersMade = true)
        })
}

function checkAndCreateFolder(folderName) {
    const folderPath = path.join(root, folderName);
    return new Promise((resolve) => {
        fs.access(folderPath, fs.constants.F_OK, err => {
            if (err) fs.mkdir(folderPath, async (err) => await writeLog(err ? `Error creating folder: ${err}` : `Created folder: ${folderName}/`));
            resolve();
        });
    });
}

function writeLog(msg) {
    const log = path.join(root, "runtime.log")
    const time = new Date().toISOString();
    const message = `[${time}] ${msg}\n`;
    return new Promise(res => fs.appendFile(log, message, err => res(err && console.error(err))))
}

// decorator for retrying operations with exponential backoff
function retry(fn, maxRetries = 5) {
    let interval = 500;

    const backoff = async () => {
        try {
            await fn();
        } catch (err) {
            const limit = Math.pow(2, maxRetries) * 500
            if (interval > limit) {
                await writeLog(`Max retries reached for operation: ${err.message}`);
                return;
            }
            await writeLog(`Retrying in ${interval}ms... (${interval}/${limit})`);
            await new Promise(res => setTimeout(res, interval *= 2));
            await backoff();
        }
    };
    return backoff;
}

async function categoriseFile(file, maxRetries = 5) {
    const fileExtension = path.extname(file).toLowerCase();
    // skip whitelisted files and folders
    if (whitelist.includes(file)) return;

    const currentFilePath = path.join(root, file)
    const destinationFilePath = (category) => path.join(root, category, file)

    const moveToCategory = (category, destination) => {
        return new Promise((res, rej) => {
            // error callback will run regardless of success or failure
            fs.rename(currentFilePath, destinationFilePath(destination), async (err) => {
                switch (err?.code) {
                    case "EEXIST":
                        // file already exists so do nothing 
                        return
                    case "ENOENT":
                        // create folder since its not there
                        await checkAndCreateFolder(category);
                        break;
                    case "EBUSY":
                        // throw err for retry to catch
                        await writeLog(`File busy, will retry: ${file}`);
                        rej(new Error("File busy"));
                }

                const message = err ? `Error moving file: ${err}` : `Moved: ${file} to ${category}/`;
                await writeLog(message);

                if (!err) directory.get("files").delete(file)
                res();
            });
        });

    }

    for (const category in categories) {
        if (categories[category].includes(fileExtension)) {
            const categoryPath = path.join(root, category);
            return await retry(() => moveToCategory(category, categoryPath), maxRetries)();
        }
    }

    // move to 'others' if folder or unrecognized file type
    const categoryPath = path.join(root, "others");
    const destination = destinationFilePath(categoryPath);

    return await retry(() => moveToCategory("others", destination), maxRetries)();
}

function createWatcher(options) {
    /* timeout in a closure to preserve the state */
    let timeout = null;
    return {
        run: () => {
            clearTimeout(timeout)
            timeout = setTimeout(async () => await main({ ...options }), options.interval)
        }
    }
}

function shutdown() {
    const handler = (signal) => writeLog(`Service stopped (${signal})`).then(() => process.exit(0));
    ["SIGINT", "SIGTERM", "SIGHUP", "SIGKILL"].forEach(sig => process.on(sig, handler));
}

async function main(options = { startup: false, interval: 1000, createCategories: false }) {
    const runtime = async () => {
        try {
            const directory = await getDirectoryFiles()
            if (options.createCategories) createCategoryFolders();
            directory.get("files").forEach(async (file) => await categoriseFile(file))
            directory.get("folders").forEach(async (folder) => await categoriseFile(folder))
        }
        catch (err) {
            await writeLog("Failed to get directory files")
            console.error(err)
        }
    }

    const boot = async () => {
        await writeLog("Service Started");
        if (options.createCategories) createCategoryFolders();
        await runtime();
        return createWatcher({ interval: 1000, ...options, startup: false, createCategories: false });
    }

    return options.startup ? await boot() : await runtime();
}

const options = { startup: true, interval: 1500 };
const watcher = await main(options);

fs.watch(root, (eventType, _) => (eventType === "rename") && watcher.run());
console.log("Watching for file changes...");
shutdown()
