import Foundation

@main
struct ResourceLocatorTests {
    static func main() throws {
        let manager = FileManager.default
        let temporary = manager.temporaryDirectory.appendingPathComponent("waraq-resources-" + UUID().uuidString, isDirectory: true)
        try manager.createDirectory(at: temporary, withIntermediateDirectories: true)
        defer { try? manager.removeItem(at: temporary) }

        func fixture(_ path: String, complete: Bool = true) throws -> URL {
            let root = temporary.appendingPathComponent(path, isDirectory: true)
            let files = complete ? ["dictionaries.sqlite", "Web/index.html", "Web/app.js", "Web/app.css", "Web/morphology/manifest.json", "Web/dictionaries/kaikki.json", "Web/dictionaries/lane.json"] : ["dictionaries.sqlite"]
            for relative in files {
                let file = root.appendingPathComponent(relative)
                try manager.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
                try Data("fixture".utf8).write(to: file)
            }
            return root
        }
        func check(_ name: String, roots: [URL], expected: URL?) {
            let actual = WaraqResources.locate(inDirectories: roots)?.standardizedFileURL.path
            precondition(actual == expected?.standardizedFileURL.path, "Failed: \(name), got \(actual ?? "nil")")
            print("PASS: " + name)
        }
        let copied = try fixture("Copied.app/Resources")
        check("copied Resources directory", roots: [copied.deletingLastPathComponent()], expected: copied)

        let data = try fixture("Current.app/WaraqData")
        check("copied WaraqData directory", roots: [data.deletingLastPathComponent()], expected: data)
        let legacy = try fixture("Current.app/Resources")
        check("WaraqData preferred over legacy Resources", roots: [legacy.deletingLastPathComponent()], expected: data)

        let nestedData = try fixture("CurrentNested.app/ArbitraryTarget.bundle/WaraqData")
        check("WaraqData in SwiftPM bundle", roots: [temporary.appendingPathComponent("CurrentNested.app")], expected: nestedData)

        let direct = try fixture("Direct.app")
        check("resources directly in app", roots: [direct], expected: direct)

        let nested = try fixture("Nested.app/WaraqReader_AppModule.bundle/Resources")
        check("SwiftPM resource bundle", roots: [temporary.appendingPathComponent("Nested.app")], expected: nested)

        let renamed = try fixture("Renamed.app/ArbitraryTarget.bundle/Resources")
        check("bundle name is not hardcoded", roots: [temporary.appendingPathComponent("Renamed.app")], expected: renamed)

        let partial = try fixture("Partial.app/Resources", complete: false)
        check("incomplete resource trees are rejected", roots: [partial.deletingLastPathComponent()], expected: nil)
        check("missing resources are rejected", roots: [temporary.appendingPathComponent("Missing.app")], expected: nil)
        check("main resources preferred over nested bundles", roots: [copied.deletingLastPathComponent(), nested.deletingLastPathComponent().deletingLastPathComponent()], expected: copied)

        let macResources = try fixture("Mac.app/Contents/Resources/Resources")
        let app = temporary.appendingPathComponent("Mac.app")
        let info: [String: Any] = ["CFBundleIdentifier":"local.waraq.fixture", "CFBundleName":"WaraqFixture", "CFBundlePackageType":"APPL"]
        try PropertyListSerialization.data(fromPropertyList: info, format: .xml, options: 0).write(to: app.appendingPathComponent("Contents/Info.plist"))
        guard let bundle = Bundle(url: app) else { fatalError("Could not load fixture bundle") }
        precondition(WaraqResources.locate(in: bundle)?.standardizedFileURL.path == macResources.standardizedFileURL.path)
        print("PASS: Foundation Bundle.resourceURL layout")

        let currentMacData = try fixture("CurrentMac.app/Contents/Resources/WaraqData")
        let currentMac = temporary.appendingPathComponent("CurrentMac.app")
        try PropertyListSerialization.data(fromPropertyList: info, format: .xml, options: 0).write(to: currentMac.appendingPathComponent("Contents/Info.plist"))
        guard let currentMacBundle = Bundle(url: currentMac) else { fatalError("Could not load current macOS fixture bundle") }
        precondition(WaraqResources.locate(in: currentMacBundle)?.standardizedFileURL.path == currentMacData.standardizedFileURL.path)
        print("PASS: WaraqData in Foundation macOS resourceURL layout")
    }
}
