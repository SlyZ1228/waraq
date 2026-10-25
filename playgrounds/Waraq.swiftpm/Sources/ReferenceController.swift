import UIKit
import PDFKit

final class ReferenceController: UIViewController, UITextFieldDelegate {
    private let store: LocalStore
    private let fingerprint: String
    private let root: String
    private let pdf: PDFDocument
    private let pdfView = PDFView()
    private let pageField = UITextField()
    private let pageLabel = UILabel()
    private var state: [String:Any]
    private var observer: NSObjectProtocol?
    init(store: LocalStore, fingerprint: String, root: String) throws {
        guard fingerprint.count == 64, fingerprint.allSatisfy({"0123456789abcdef".contains($0)}),
              let pdf = PDFDocument(url: store.root.appendingPathComponent("reference").appendingPathComponent(fingerprint + ".pdf")) else {
            throw WaraqError.message("The saved PDF could not be opened. Import it again in Settings.")
        }
        self.store=store; self.fingerprint=fingerprint; self.root=root.replacingOccurrences(of:" ",with:"")
        self.pdf=pdf
        self.state = (try store.getSetting("pdf:" + fingerprint) as? [String:Any]) ?? [:]
        super.init(nibName:nil,bundle:nil)
    }
    required init?(coder: NSCoder) { fatalError("Use init(store:fingerprint:root:)") }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        title = root.isEmpty ? "Personal reference" : "Reference · \(root)"
        navigationItem.leftBarButtonItem = UIBarButtonItem(barButtonSystemItem:.done,target:self,action:#selector(close))
        if !root.isEmpty { navigationItem.rightBarButtonItem = UIBarButtonItem(title:"Save root here",style:.plain,target:self,action:#selector(saveRoot)) }
        pdfView.document=pdf; pdfView.autoScales=true; pdfView.displayMode = .singlePageContinuous; pdfView.displayDirection = .vertical
        pageField.borderStyle = .roundedRect; pageField.keyboardType = .numberPad; pageField.placeholder="Page"; pageField.delegate=self
        pageField.accessibilityLabel="PDF page number"
        let go=UIButton(type:.system); go.setTitle("Go",for:.normal); go.addTarget(self,action:#selector(goToPage),for:.touchUpInside)
        let previous=UIButton(type:.system); previous.setTitle("Previous",for:.normal); previous.addTarget(self,action:#selector(previousPage),for:.touchUpInside)
        let next=UIButton(type:.system); next.setTitle("Next",for:.normal); next.addTarget(self,action:#selector(nextPage),for:.touchUpInside)
        let bar=UIStackView(arrangedSubviews:[previous,pageField,go,pageLabel,next]); bar.axis = .horizontal;bar.spacing=12;bar.alignment = .center
        bar.translatesAutoresizingMaskIntoConstraints=false;pdfView.translatesAutoresizingMaskIntoConstraints=false
        view.addSubview(bar);view.addSubview(pdfView)
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor,constant:10),bar.leadingAnchor.constraint(equalTo:view.leadingAnchor,constant:16),bar.trailingAnchor.constraint(equalTo:view.trailingAnchor,constant:-16),bar.heightAnchor.constraint(equalToConstant:42),
            pageField.widthAnchor.constraint(equalToConstant:75),
            pdfView.topAnchor.constraint(equalTo:bar.bottomAnchor,constant:10),pdfView.leadingAnchor.constraint(equalTo:view.leadingAnchor),pdfView.trailingAnchor.constraint(equalTo:view.trailingAnchor),pdfView.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor)
        ])
        let roots=state["roots"] as? [String:Int] ?? [:]
        let page=roots[root] ?? (state["page"] as? Int ?? 0)
        if let target=pdf.page(at:max(0,min(pdf.pageCount-1,page))) {pdfView.go(to:target)}
        observer=NotificationCenter.default.addObserver(forName:.PDFViewPageChanged,object:pdfView,queue:.main) { [weak self] _ in self?.savePage() }
        savePage()
    }
    deinit { if let observer=observer {NotificationCenter.default.removeObserver(observer)} }
    private func savePage() {
        guard let page=pdfView.currentPage else {return}
        let index=pdf.index(for:page); state["page"]=index; pageLabel.text="\(index+1) / \(pdf.pageCount)"
        do {try store.setSetting("pdf:"+fingerprint,state)} catch {pageLabel.text="Position not saved"}
    }
    override func viewWillDisappear(_ animated: Bool) { super.viewWillDisappear(animated); savePage() }
    @objc private func goToPage() { if let number=Int(pageField.text ?? ""), number > 0, number <= pdf.pageCount, let page=pdf.page(at:number-1) {pdfView.go(to:page);pageField.resignFirstResponder()} }
    @objc private func previousPage() {pdfView.goToPreviousPage(nil)}
    @objc private func nextPage() {pdfView.goToNextPage(nil)}
    @objc private func close() {savePage();dismiss(animated:true)}
    @objc private func saveRoot() {
        guard let page=pdfView.currentPage else {return}
        var roots=state["roots"] as? [String:Int] ?? [:]; roots[root]=pdf.index(for:page);state["roots"]=roots
        do {try store.setSetting("pdf:"+fingerprint,state);navigationItem.rightBarButtonItem?.title="Root saved"}
        catch {navigationItem.rightBarButtonItem?.title="Could not save"}
    }
    func textFieldShouldReturn(_ textField:UITextField)->Bool {goToPage();return true}
}
