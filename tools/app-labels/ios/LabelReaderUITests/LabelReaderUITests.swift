import XCTest

/// Reads Google Authenticator's "Transfer accounts" > "Export accounts" labels.
///
/// Privacy: this never taps Export, never reads account rows, and only
/// prints labels from the app's own chrome, filtered to drop anything that
/// could be an email address or a code.
final class LabelReaderUITests: XCTestCase {
    let bundleID = "com.google.Authenticator"
    /// The hamburger menu, top left (its accessibility label is "Info").
    let menuButton = "kOTPAIMainInfoButton"

    /// Languages to read, as iOS language codes: the languages each app lists
    /// on the App Store, plus regional variants. To check an app's list:
    /// curl "https://itunes.apple.com/lookup?bundleId=<id>" (languageCodesISO2A).
    let languages = [
        "en", "ar", "ca", "hr", "cs", "da", "nl", "fi", "fr", "fr-CA", "de", "el",
        "he", "hu", "id", "it", "ja", "ko", "ms", "nb", "pl", "pt-BR", "pt-PT",
        "ro", "ru", "zh-Hans", "zh-Hant", "sk", "es", "es-419", "sv", "th", "tr",
        "uk", "vi",
    ]
    let lastPassLanguages = [
        "en", "nl", "fr", "fr-CA", "de", "it", "pt-BR", "pt-PT", "es", "es-419",
    ]

    override func setUp() {
        continueAfterFailure = true
    }

    /// Drops labels that could contain personal data.
    func safe(_ label: String) -> String? {
        if label.isEmpty || label.contains("@") { return nil }
        if label.range(of: #"\d{3}"#, options: .regularExpression) != nil { return nil }
        return label.count > 60 ? String(label.prefix(60)) + "…" : label
    }

    func launch(_ lang: String) -> XCUIApplication {
        let app = XCUIApplication(bundleIdentifier: bundleID)
        app.terminate()
        app.launchArguments = ["-AppleLanguages", "(\(lang))", "-AppleLocale", lang.replacingOccurrences(of: "-", with: "_")]
        app.launch()
        // Allow time for a Face ID prompt, if the app asks for one.
        _ = app.buttons[menuButton].waitForExistence(timeout: 30)
        sleep(1)
        return app
    }

    func log(_ s: String) { print("LABELREADER: \(s)") }

    /// Reads "Transfer accounts" (first item in the hamburger menu) and
    /// "Export accounts" (on the Transfer screen) in every language, printing
    /// one RESULT line each. Never taps Export.
    func testReadLabels() throws {
        // Find where "Export accounts" sits on the Transfer screen, in English.
        var exportIndex = -1
        do {
            let app = launch("en")
            app.buttons[menuButton].tap()
            XCTAssertTrue(app.cells.element(boundBy: 0).waitForExistence(timeout: 5))
            app.cells.element(boundBy: 0).tap()
            sleep(2)
            let cells = app.cells.allElementsBoundByIndex
            exportIndex = cells.firstIndex { $0.label == "Export accounts" } ?? -1
            log("export cell index: \(exportIndex)")
            app.terminate()
        }
        XCTAssertGreaterThanOrEqual(exportIndex, 0)
        var english: (String, String)? = nil
        // LABEL_LANGS (set as TEST_RUNNER_LABEL_LANGS when running xcodebuild)
        // limits the run to some languages, e.g. to retry one.
        let only = ProcessInfo.processInfo.environment["LABEL_LANGS"]?
            .split(separator: ",").map(String.init)
        for lang in only.map({ ["en"] + $0 }) ?? languages {
            let app = launch(lang)
            guard app.buttons[menuButton].exists else {
                log("RESULT|\(lang)|<menu not found>|")
                continue
            }
            app.buttons[menuButton].tap()
            let transfer = app.cells.element(boundBy: 0)
            guard transfer.waitForExistence(timeout: 5) else {
                log("RESULT|\(lang)|<menu did not open>|")
                continue
            }
            let transferLabel = transfer.label
            transfer.tap()
            sleep(2)
            let export = app.cells.element(boundBy: exportIndex)
            let exportLabel = export.waitForExistence(timeout: 5) ? export.label : "<not found>"
            if lang == "en" { english = (transferLabel, exportLabel) }
            let fallback = lang != "en" && english.map { $0 == (transferLabel, exportLabel) } == true
            log("RESULT|\(lang)|\(safe(transferLabel) ?? "<hidden>")|\(safe(exportLabel) ?? "<hidden>")\(fallback ? "|same as English" : "")")
            app.terminate()
        }
    }

    /// Discovery, English only: find the hamburger menu (top left) and the
    /// Transfer accounts item in it.
    func testDiscover() throws {
        let app = launch("en")
        // Anything in the top-left corner: the hamburger menu lives there.
        let corner = app.descendants(matching: .any).allElementsBoundByIndex.filter {
            $0.exists && $0.frame.maxY < 200 && $0.frame.minX < 120 && $0.frame.width < 200 && $0.frame.width > 10
        }
        for (i, e) in corner.enumerated() {
            log("corner[\(i)] type=\(e.elementType.rawValue) id=\(e.identifier) label=\(safe(e.label) ?? "<hidden>") frame=\(e.frame)")
        }
        let target = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Transfer accounts")).firstMatch
        for (i, e) in corner.enumerated() where e.isHittable {
            log("tapping corner[\(i)]")
            e.tap()
            sleep(2)
            if target.waitForExistence(timeout: 3) {
                log("FOUND Transfer accounts after corner[\(i)] type=\(target.elementType.rawValue) id=\(target.identifier)")
                let items = app.descendants(matching: target.elementType).allElementsBoundByIndex
                for (j, e) in items.enumerated() where e.exists && e.isHittable {
                    log("menu item[\(j)] id=\(e.identifier) label=\(safe(e.label) ?? "<hidden>")")
                }
                target.tap()
                sleep(2)
                let export = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Export accounts")).firstMatch
                log("Export accounts exists: \(export.exists) type=\(export.elementType.rawValue) id=\(export.identifier)")
                for (j, e) in app.buttons.allElementsBoundByIndex.enumerated() where e.exists {
                    log("transfer screen button[\(j)] id=\(e.identifier) label=\(safe(e.label) ?? "<hidden>")")
                }
                app.terminate()
                return
            }
            _ = launch("en")
        }
        log("Transfer accounts not found")
        app.terminate()
    }

    // MARK: - LastPass Authenticator

    let lastPassID = "com.lastpass.authenticator"

    func launchLastPass(_ lang: String) -> XCUIApplication {
        let app = XCUIApplication(bundleIdentifier: lastPassID)
        app.terminate()
        app.launchArguments = ["-AppleLanguages", "(\(lang))", "-AppleLocale", lang.replacingOccurrences(of: "-", with: "_")]
        app.launch()
        // Allow time for Face ID or a PIN, if the app asks for one.
        _ = app.buttons.firstMatch.waitForExistence(timeout: 45)
        sleep(3)
        return app
    }

    /// Discovery, English only: find the settings cog and the Transfer
    /// accounts screen's export options. Never taps an export option.
    func testDiscoverLastPass() throws {
        let app = launchLastPass("en")
        let height = app.windows.firstMatch.frame.height
        let chrome = app.descendants(matching: .any).allElementsBoundByIndex.filter {
            $0.exists && $0.frame.width > 10 && $0.frame.width < 200 && ($0.frame.maxY < 200 || $0.frame.minY > height - 200)
        }
        for (i, e) in chrome.enumerated() {
            log("chrome[\(i)] type=\(e.elementType.rawValue) id=\(e.identifier) label=\(safe(e.label) ?? "<hidden>")")
        }
        let target = app.descendants(matching: .any).matching(NSPredicate(format: "label ==[c] %@", "Transfer accounts")).firstMatch
        let words = ["setting", "cog", "gear", "menu", "more", "option"]
        for (i, e) in chrome.enumerated() where e.isHittable {
            let text = (e.label + " " + e.identifier).lowercased()
            guard words.contains(where: { text.contains($0) }) else { continue }
            log("tapping chrome[\(i)]")
            e.tap()
            sleep(2)
            if target.waitForExistence(timeout: 3) {
                let items = app.descendants(matching: target.elementType).allElementsBoundByIndex
                let index = items.firstIndex { $0.label.caseInsensitiveCompare("Transfer accounts") == .orderedSame } ?? -1
                log("FOUND Transfer accounts after chrome[\(i)] type=\(target.elementType.rawValue) index=\(index) id=\(target.identifier)")
                target.tap()
                sleep(2)
                for (j, e) in (app.buttons.allElementsBoundByIndex + app.cells.allElementsBoundByIndex + app.staticTexts.allElementsBoundByIndex).enumerated() where e.exists {
                    log("transfer screen[\(j)] type=\(e.elementType.rawValue) id=\(e.identifier) label=\(safe(e.label) ?? "<hidden>")")
                }
                app.terminate()
                return
            }
            _ = launchLastPass("en")
        }
        log("Transfer accounts not found")
        app.terminate()
    }

    /// Reads LastPass Authenticator's "Transfer accounts" (in Settings) and
    /// its two export options in every language, printing one LASTPASS line
    /// each. Never taps an export option.
    func testReadLastPassLabels() throws {
        let only = ProcessInfo.processInfo.environment["LABEL_LANGS"]?
            .split(separator: ",").map(String.init)
        var english: [String]? = nil
        for lang in only.map({ ["en"] + $0 }) ?? lastPassLanguages {
            let app = launchLastPass(lang)
            let settings = app.buttons["ButtonSettings"].firstMatch
            guard settings.waitForExistence(timeout: 10) else {
                log("LASTPASS|\(lang)|<settings not found>")
                continue
            }
            settings.tap()
            sleep(2)
            // In English, "Transfer accounts" is the sixth button in Settings.
            let transfer = app.buttons.element(boundBy: 5)
            guard transfer.waitForExistence(timeout: 5) else {
                log("LASTPASS|\(lang)|<transfer not found>")
                continue
            }
            let transferLabel = transfer.label
            transfer.tap()
            sleep(2)
            let toQR = app.buttons.element(boundBy: 1)
            let toFile = app.buttons.element(boundBy: 2)
            let labels = [transferLabel, toQR.exists ? toQR.label : "<not found>", toFile.exists ? toFile.label : "<not found>"]
            if lang == "en" { english = labels }
            let fallback = lang != "en" && english == labels
            log("LASTPASS|\(lang)|" + labels.map { safe($0) ?? "<hidden>" }.joined(separator: "|") + (fallback ? "|same as English" : ""))
            app.terminate()
        }
    }
}
