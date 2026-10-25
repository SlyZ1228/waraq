import Foundation
import CryptoKit
import SQLite3

enum WaraqError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let text) = self { return text }; return nil }
}

// All mutations are serialized by ReaderController's storage queue. Metadata is
// written atomically as the user moves through a book, not only when the app exits.
final class LocalStore {
    let root: URL
    let resources: URL
    var database: OpaquePointer?
    init() throws {
        guard let resources = WaraqResources.locate() else {
            throw WaraqError.message("The bundled reader resources are missing or incomplete. Open the complete Waraq.swiftpm from the release ZIP, including Sources/Resources. GitHub's Source code ZIP does not contain these resources.")
        }
        self.resources = resources
        root = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("Waraq", isDirectory: true)
        for folder in [root, root.appendingPathComponent("books"), root.appendingPathComponent("settings"), root.appendingPathComponent("reference")] {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        }
        let dbURL = resources.appendingPathComponent("dictionaries.sqlite")
        guard sqlite3_open_v2(dbURL.path, &database, SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
            throw WaraqError.message("The bundled dictionary index could not be opened.")
        }
    }
    deinit { sqlite3_close(database) }
    func digest(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    func json(_ url: URL) throws -> Any { try JSONSerialization.jsonObject(with: Data(contentsOf: url), options: [.fragmentsAllowed]) }
    func save(_ value: Any, to url: URL) throws {
        try JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed, .sortedKeys]).write(to: url, options: .atomic)
    }
    func settingURL(_ key: String) -> URL { root.appendingPathComponent("settings").appendingPathComponent(digest(Data(key.utf8)) + ".json") }
    func getSetting(_ key: String) throws -> Any {
        let url = settingURL(key)
        return FileManager.default.fileExists(atPath: url.path) ? try json(url) : NSNull()
    }
    func setSetting(_ key: String, _ value: Any) throws { try save(value, to: settingURL(key)) }
    func bookURL(_ id: String) throws -> URL {
        guard id.count == 64, id.allSatisfy({ "0123456789abcdef".contains($0) }) else { throw WaraqError.message("Invalid book identifier.") }
        return root.appendingPathComponent("books").appendingPathComponent(id, isDirectory: true)
    }
    func resource(_ path: String) throws -> URL {
        let webRoot = resources.appendingPathComponent("Web", isDirectory: true).standardizedFileURL
        let relative = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let url = webRoot.appendingPathComponent(relative.isEmpty ? "index.html" : relative).standardizedFileURL.resolvingSymlinksInPath()
        guard url.path.hasPrefix(webRoot.path + "/") else { throw WaraqError.message("Invalid resource path.") }
        return url
    }
    func execute(_ method: String, _ args: [String: Any]) throws -> Any {
        switch method {
        case "resource": return try Data(contentsOf: resource(args["path"] as? String ?? "")).base64EncodedString()
        case "sha256":
            guard let data = Data(base64Encoded: args["data"] as? String ?? "") else { throw WaraqError.message("Invalid file data.") }
            return digest(data)
        case "books":
            let folders = try FileManager.default.contentsOfDirectory(at: root.appendingPathComponent("books"), includingPropertiesForKeys: nil)
            return try folders.compactMap { folder -> [String: Any]? in
                let metadata = folder.appendingPathComponent("metadata.json")
                guard FileManager.default.fileExists(atPath: metadata.path) else { return nil }
                guard var record = try json(metadata) as? [String: Any] else { return nil }
                let cover = folder.appendingPathComponent("cover.bin")
                if FileManager.default.fileExists(atPath: cover.path) { record["coverBase64"] = try Data(contentsOf: cover).base64EncodedString() }
                return record
            }
        case "storeBook":
            guard var metadata = args["metadata"] as? [String: Any], let id = metadata["id"] as? String,
                  let data = Data(base64Encoded: args["data"] as? String ?? "") else { throw WaraqError.message("Invalid book data.") }
            let folder = try bookURL(id)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let path = folder.appendingPathComponent("metadata.json")
            if FileManager.default.fileExists(atPath: path.path), let old = try json(path) as? [String: Any] {
                for key in ["addedAt","lastRead","location","progress","chapter","bookmarks"] { if let value = old[key] { metadata[key] = value } }
                if old["metadataEdited"] as? Bool == true { for key in ["title","author","metadataEdited"] { metadata[key] = old[key] } }
            }
            try data.write(to: folder.appendingPathComponent("book.epub"), options: .atomic)
            if let encoded = args["cover"] as? String, let cover = Data(base64Encoded: encoded) {
                try cover.write(to: folder.appendingPathComponent("cover.bin"), options: .atomic)
                metadata["coverType"] = args["coverType"]
            }
            try save(metadata, to: path)
            return true
        case "bookData": return try Data(contentsOf: bookURL(args["id"] as? String ?? "").appendingPathComponent("book.epub")).base64EncodedString()
        case "updateBook":
            let path = try bookURL(args["id"] as? String ?? "").appendingPathComponent("metadata.json")
            guard var record = try json(path) as? [String: Any], let updates = args["updates"] as? [String: Any] else { throw WaraqError.message("Could not save book details.") }
            for key in ["title","author","metadataEdited","location","progress","chapter","lastRead","bookmarks"] {
                if let value = updates[key] { record[key] = value }
            }
            try save(record, to: path); return true
        case "removeBook": try FileManager.default.removeItem(at: bookURL(args["id"] as? String ?? "")); return true
        case "getSetting": return try getSetting(args["key"] as? String ?? "")
        case "setSetting": try setSetting(args["key"] as? String ?? "", args["value"] ?? NSNull()); return true
        case "packs": return try ["kaikki","lane"].map { try json(resource("/dictionaries/\($0).json")) }
        case "entries": return try entries(keys: args["keys"] as? [String] ?? [], root: args["root"] as? String)
        default: throw WaraqError.message("Unknown native operation.")
        }
    }
    func entries(keys: [String], root: String?) throws -> [Any] {
        let values = root.map { [$0] } ?? Array(keys.prefix(4))
        if values.isEmpty { return [] }
        let sql = root != nil ? "SELECT json FROM entries WHERE root=? ORDER BY id LIMIT 1000" :
          "SELECT DISTINCT e.id,e.json FROM entries e JOIN lookup k ON e.id=k.entry WHERE k.word IN (\(values.map { _ in "?" }.joined(separator: ","))) ORDER BY e.id LIMIT 1000"
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK else { throw WaraqError.message("Dictionary query failed.") }
        defer { sqlite3_finalize(statement) }
        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        for (i,value) in values.enumerated() { _ = value.withCString { sqlite3_bind_text(statement, Int32(i+1), $0, -1, transient) } }
        var result: [Any] = []
        var status = sqlite3_step(statement)
        while status == SQLITE_ROW {
            let column: Int32 = root != nil ? 0 : 1
            if let ptr = sqlite3_column_text(statement, column) {
                let text = String(cString: ptr)
                result.append(try JSONSerialization.jsonObject(with: Data(text.utf8)))
            }
            status = sqlite3_step(statement)
        }
        guard status == SQLITE_DONE else { throw WaraqError.message("Could not finish the dictionary query.") }
        return result
    }
}
