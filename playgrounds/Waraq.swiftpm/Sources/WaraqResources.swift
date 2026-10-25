import Foundation

// App playgrounds do not always generate SwiftPM's Bundle.module accessor.
// Locate our complete resource tree inside the application instead. The copy
// rule preserves WaraqData/ in SwiftPM; Playgrounds can use the main bundle.
// A root folder literally named Resources changes Apple's bundle signing rules.
enum WaraqResources {
    static func locate(in appBundle: Bundle = .main) -> URL? {
        let directories = [appBundle.resourceURL, appBundle.bundleURL].compactMap { $0 }
        return locate(inDirectories: directories)
    }

    static func locate(inDirectories directories: [URL]) -> URL? {
        let manager = FileManager.default
        let required = ["dictionaries.sqlite", "Web/index.html", "Web/app.js", "Web/app.css",
                        "Web/morphology/manifest.json", "Web/dictionaries/kaikki.json", "Web/dictionaries/lane.json"]
        func resourceTree(at directory: URL) -> URL? {
            for candidate in [directory.appendingPathComponent("WaraqData", isDirectory: true),
                              directory.appendingPathComponent("Resources", isDirectory: true), directory] {
                if required.allSatisfy({ relative in
                    var isDirectory: ObjCBool = false
                    return manager.fileExists(atPath: candidate.appendingPathComponent(relative).path, isDirectory: &isDirectory) && !isDirectory.boolValue
                }) { return candidate }
            }
            return nil
        }
        var seen = Set<String>()
        let roots = directories.filter { seen.insert($0.standardizedFileURL.path).inserted }
        // Prefer resources copied directly into the app.
        for root in roots {
            if let resources = resourceTree(at: root) { return resources }
        }
        // A normal SwiftPM/Xcode build may use a separate resource bundle.
        // Inspect only immediate app-owned bundles, never user library folders.
        for root in roots {
            let children = (try? manager.contentsOfDirectory(at: root, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles])) ?? []
            for child in children.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) where child.pathExtension == "bundle" {
                let bundle = Bundle(url: child)
                for directory in [bundle?.resourceURL, child].compactMap({ $0 }) {
                    if let resources = resourceTree(at: directory) { return resources }
                }
            }
        }
        return nil
    }
}
