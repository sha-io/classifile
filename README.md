# Classifile

An automated file organisation service that watches a directory and automatically categorises files into organised folders based on their file extensions.

## Features

- **Automatic File Categorization**: Watches a directory and moves files into category folders based on file type
- **Real-time Monitoring**: Uses file system watcher to detect new files and changes
- **Automatic Folder Creation**: Creates category folders automatically if they don't exist
- **Error Handling**: Implements retry logic with exponential backoff for handling file locks and system conflicts
- **Logging**: Logs all operations to `runtime.log` for debugging and monitoring

## Categories

The service organizes files into the following categories:

| Category      | File Types                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **images**    | `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.svg`, `.webp`, `.tiff`, `.ico`, `.raw`, `.heic`, `.ai`, `.psd`, `.eps`                                       |
| **documents** | `.pdf`, `.doc`, `.docx`, `.txt`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.ods`, `.odt`, `.rtf`, `.csv`, `.json`, `.geojson`, `.xml`, `.md`, `.tex`, `.epub`  |
| **programs**  | `.exe`, `.msi`, `.dmg`, `.pkg`, `.app`, `.deb`, `.rpm`, `.bin`, `.sh`, `.bat`, `.cmd`                                                                   |
| **audio**     | `.mp3`, `.wav`, `.aac`, `.flac`, `.ogg`, `.m4a`, `.wma`, `.aiff`, `.opus`                                                                               |
| **video**     | `.mp4`, `.avi`, `.mkv`, `.mov`, `.webm`, `.flv`, `.vob`, `.wmv`, `.m4v`, `.3gp`                                                                         |
| **archives**  | `.zip`, `.rar`, `.tar`, `.gz`, `.7z`, `.bz2`, `.xz`, `.iso`, `.dmg`, `.jar`                                                                             |
| **code**      | `.js`, `.jsx`, `.ts`, `.tsx`, `.py`, `.java`, `.cpp`, `.c`, `.cs`, `.h`, `.html`, `.css`, `.scss`, `.php`, `.go`, `.rs`, `.rb`, `.sql`, `.yaml`, `.yml` |
| **fonts**     | `.ttf`, `.otf`, `.woff`, `.woff2`, `.eot`                                                                                                               |
| **database**  | `.db`, `.sqlite`, `.sqlite3`, `.mdb`, `.accdb`, `.sql`                                                                                                  |
| **tunnels**   | `.ovpn`, `.conf`, `.wireguard`, `.crt`, `.key`, `.pem`, `.p12`                                                                                          |
| **others**    | Unrecognized files and folders                                                                                                                          |

## Usage

### Starting the Service

```javascript
node service.js
```

### Options

You can customize the service behavior by modifying the `options` object:

```javascript
const options = {
  startup: true, // Only indicates if a watcher should be created after running
  interval: 1500, // Interval in milliseconds for checking changes
  createCategories: true, // Automatically create category folders on startup
};
```

## Configuration

### Whitelist

To prevent certain files or folders from being categorized, add them to the `whitelist` array:

```javascript
const whitelist = ["service.js", "runtime.log", ...Object.keys(categories)];
```

By default, the service ignores:

- `service.js` (the service itself)
- `runtime.log` (the log file)
- All category folder names

### Custom Categories

To add or modify categories, edit the `categories` object:

```javascript
const categories = {
  mycategory: [".ext1", ".ext2", ".ext3"],
  // ... other categories
};
```

## How It Works

1. **Initialisation**: Creates category folders (if enabled)
2. **Directory Scan**: Reads all files and folders in the root directory
3. **Categorisation**: For each file:
   - Checks file extension against known categories
   - Moves file to corresponding category folder
   - Falls back to **"others"** folder if no match
4. **Watching**: Uses `fs.watch()` to monitor for file changes
5. **Retry Logic**: Implements exponential backoff for file operations that fail due to locks

## Logging

All operations are logged to `runtime.log` with ISO timestamps:

```
[2026-01-14T12:34:56.789Z] Service Started
[2026-01-14T12:34:56.800Z] Created folder: images/
[2026-01-14T12:34:57.123Z] Moved: photo.jpg to images/
```

## Graceful Shutdown

The service listens for system signals and logs shutdown events:

```javascript
// Handles: SIGINT, SIGTERM, SIGHUP, SIGKILL
```

Stop the service with `Ctrl+C`.

## Requirements

- Node.js (v14+ recommended)
- File system access to the target directory

## Error Handling

The service handles common file operation errors:

- **EEXIST**: File already exists in destination (skipped)
- **ENOENT**: Destination folder doesn't exist (folder created automatically)
- **EBUSY**: File is locked (automatic retry with exponential backoff)

## Example

```bash
# Start the service
node service.js

# Check the log file
cat runtime.log

# Stop the service
Ctrl+C
```

After running, your directory structure will look like:

```
.
├── service.js
├── runtime.log
├── images/
│   ├── photo.jpg
│   └── screenshot.png
├── documents/
│   ├── report.pdf
│   └── notes.txt
├── code/
│   ├── script.js
│   └── style.css
└── ... other categories
```

## Notes

- The service runs the categorisation on startup and whenever files are renamed/added
- Files that already exist in the destination folder are skipped
- The service is designed to work with the current directory as root (`.`)
