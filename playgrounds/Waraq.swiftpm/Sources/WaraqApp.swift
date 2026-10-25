import SwiftUI

@main
struct WaraqApp: App {
    var body: some Scene {
        WindowGroup { ReaderHost().ignoresSafeArea(.container, edges: .bottom) }
    }
}

struct ReaderHost: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> ReaderController { ReaderController() }
    func updateUIViewController(_ controller: ReaderController, context: Context) {}
}
