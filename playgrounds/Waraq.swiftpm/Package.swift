// swift-tools-version: 5.9
import PackageDescription
import AppleProductTypes

let package = Package(
    name: "WaraqReader",
    platforms: [.iOS("17.0")],
    products: [.iOSApplication(
        name: "Waraq", targets: ["AppModule"],
        bundleIdentifier: "local.waraq.reader", displayVersion: "0.2.4", bundleVersion: "6",
        appIcon: .asset("AppIcon"), accentColor: .presetColor(.green),
        supportedDeviceFamilies: [.pad],
        supportedInterfaceOrientations: [.portrait, .landscapeLeft, .landscapeRight, .portraitUpsideDown(.when(deviceFamilies: [.pad]))]
    )],
    targets: [.executableTarget(name: "AppModule", path: "Sources",
        resources: [.copy("WaraqData"), .process("Assets.xcassets")],
        linkerSettings: [.linkedLibrary("sqlite3")])],
    swiftLanguageVersions: [.v5]
)
