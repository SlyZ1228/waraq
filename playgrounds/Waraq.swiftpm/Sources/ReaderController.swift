import UIKit
import WebKit
import UniformTypeIdentifiers
import PDFKit

final class BundleScheme: NSObject, WKURLSchemeHandler {
    let store: LocalStore
    init(store: LocalStore) { self.store = store }
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        // Bundled assets are small; morphology goes through the asynchronous bridge.
        do {
            guard let url = urlSchemeTask.request.url, url.host == "app" else { throw WaraqError.message("Unknown resource.") }
            let file = try store.resource(url.path)
            let data = try Data(contentsOf: file)
            let mime = ["html":"text/html","js":"application/javascript","css":"text/css","json":"application/json","png":"image/png","svg":"image/svg+xml","woff2":"font/woff2","epub":"application/epub+zip"][file.pathExtension] ?? "application/octet-stream"
            let response = URLResponse(url: url, mimeType: mime, expectedContentLength: data.count, textEncodingName: ["html","js","css","json","svg"].contains(file.pathExtension) ? "utf-8" : nil)
            urlSchemeTask.didReceive(response); urlSchemeTask.didReceive(data); urlSchemeTask.didFinish()
        } catch { urlSchemeTask.didFailWithError(error) }
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}

final class ReaderController: UIViewController, WKScriptMessageHandlerWithReply, WKNavigationDelegate, WKUIDelegate, UIDocumentPickerDelegate {
    private var store: LocalStore!
    private var webView: WKWebView!
    private let storageQueue = DispatchQueue(label: "local.waraq.storage", qos: .userInitiated)
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        do { store = try LocalStore() } catch { showStartupError(error.localizedDescription); return }
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.setURLSchemeHandler(BundleScheme(store: store), forURLScheme: "waraq")
        configuration.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "waraq")
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self; webView.uiDelegate = self
        webView.scrollView.bounces = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.97, green: 0.96, blue: 0.94, alpha: 1)
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor), webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor), webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        webView.load(URLRequest(url: URL(string: "waraq://app/index.html")!))
    }
    private func showStartupError(_ text: String) {
        let label = UILabel(); label.numberOfLines = 0; label.textAlignment = .center
        label.text = "Waraq could not open.\n\n" + text
        label.frame = view.bounds.insetBy(dx: 30, dy: 60); label.autoresizingMask = [.flexibleWidth,.flexibleHeight]
        view.addSubview(label)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        // Never let EPUB iframes or an external page call the file bridge.
        guard message.frameInfo.isMainFrame, let frameURL = message.frameInfo.request.url,
              frameURL.scheme == "waraq", frameURL.host == "app", frameURL.path == "/index.html",
              let body = message.body as? [String: Any], let method = body["method"] as? String else {
            replyHandler(nil, "This operation is available only to the reader."); return
        }
        let args = body["args"] as? [String: Any] ?? [:]
        switch method {
        case "referenceImport":
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.pdf], asCopy: true)
            picker.delegate = self; present(picker, animated: true); replyHandler(true,nil)
        case "referenceOpen":
            do {
                guard let meta = try store.getSetting("reference") as? [String:Any], let fingerprint = meta["fingerprint"] as? String else {
                    throw WaraqError.message("Import your own dictionary PDF in Settings first. No Hans Wehr PDF is included.")
                }
                let controller = try ReferenceController(store: store, fingerprint: fingerprint, root: args["root"] as? String ?? "")
                let navigation = UINavigationController(rootViewController: controller)
                navigation.modalPresentationStyle = .pageSheet
                present(navigation, animated: true); replyHandler(true,nil)
            } catch { replyHandler(nil,error.localizedDescription) }
        case "exportProgress":
            do {
                let data = Data((args["json"] as? String ?? "{}").utf8)
                let url = FileManager.default.temporaryDirectory.appendingPathComponent("waraq-progress.json")
                try data.write(to: url, options: .atomic)
                let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
                present(picker, animated: true); replyHandler(true,nil)
            } catch { replyHandler(nil,error.localizedDescription) }
        default:
            storageQueue.async { [weak self] in
                guard let self = self else { DispatchQueue.main.async {replyHandler(nil,"Reader closed.")}; return }
                do { let value = try self.store.execute(method,args); DispatchQueue.main.async { replyHandler(value,nil) } }
                catch { DispatchQueue.main.async { replyHandler(nil,error.localizedDescription) } }
            }
        }
    }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else { return }
        storageQueue.async { [weak self] in
            guard let self = self else { return }
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed {url.stopAccessingSecurityScopedResource()} }
            do {
                let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size <= 300 * 1024 * 1024 else { throw WaraqError.message("Please choose a PDF smaller than 300 MB.") }
                guard let pdf = PDFDocument(url: url), pdf.pageCount > 0, !pdf.isLocked else { throw WaraqError.message("Choose an unlocked, readable PDF.") }
                let data = try Data(contentsOf: url, options: .mappedIfSafe)
                let fingerprint = self.store.digest(data)
                let destination = self.store.root.appendingPathComponent("reference").appendingPathComponent(fingerprint + ".pdf")
                try data.write(to: destination, options: .atomic)
                try self.store.setSetting("reference",["fingerprint":fingerprint,"name":url.lastPathComponent])
                DispatchQueue.main.async { self.showMessage("Reference saved", "Your PDF is ready offline. Open it from Settings or the word explorer.") }
            } catch { DispatchQueue.main.async { self.showMessage("Could not import PDF", error.localizedDescription) } }
        }
    }
    private func showMessage(_ title: String, _ text: String) {
        let alert = UIAlertController(title: title, message: text, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default)); present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {decisionHandler(.cancel);return}
        if ["waraq","blob","data","about"].contains(url.scheme ?? "") { decisionHandler(.allow); return }
        if navigationAction.navigationType == .linkActivated && ["https","http"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, ["https","http"].contains(url.scheme ?? "") {UIApplication.shared.open(url)}
        return nil
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {showMessage("Reader could not load",error.localizedDescription)}
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}
