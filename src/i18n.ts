export type Language = 'en' | 'zh-CN';

type TranslationKey =
  | 'app.title'
  | 'tab.what'
  | 'tab.how'
  | 'tab.faq'
  | 'tab.what.content'
  | 'tab.use.content'
  | 'faq.1.title'
  | 'faq.1.answer'
  | 'faq.2.title'
  | 'faq.2.answer'
  | 'faq.3.title'
  | 'faq.3.answer'
  | 'faq.4.title'
  | 'faq.4.answer'
  | 'faq.5.title'
  | 'faq.5.answer'
  | 'faq.6.title'
  | 'faq.6.answer'
  | 'faq.7.title'
  | 'faq.7.answer'
  | 'faq.8.title'
  | 'faq.8.answer'
  | 'faq.9.title'
  | 'faq.9.answer'
  | 'btn.scanQr'
  | 'btn.openFiles'
  | 'btn.enterCode'
  | 'drop.hint'
  | 'field.name'
  | 'field.issuer'
  | 'field.type'
  | 'field.counter'
  | 'field.secret'
  | 'field.url'
  | 'a11y.copyHint'
  | 'a11y.copySecret'
  | 'a11y.copyUrl'
  | 'a11y.showLargerQr'
  | 'a11y.tapToEnlarge'
  | 'selection.none'
  | 'selection.all'
  | 'selection.reset'
  | 'selection.count'
  | 'btn.saveCsv'
  | 'btn.saveJson'
  | 'btn.exportGoogle'
  | 'btn.exportLastPass'
  | 'modal.scanQr'
  | 'modal.enterCode'
  | 'modal.manualHelp'
  | 'modal.manualPlaceholder'
  | 'btn.cancel'
  | 'btn.addCode'
  | 'footer.sourceCode'
  | 'theme.openSwitcher'
  | 'theme.system'
  | 'theme.light'
  | 'theme.dark'
  | 'lang.toggleTo'
  | 'error.unexpected'
  | 'error.unknown'
  | 'error.processFiles'
  | 'error.exportFailed'
  | 'error.noCamera'
  | 'error.startCamera'
  | 'error.switchCamera'
  | 'error.cameraProcess'
  | 'error.invalidJson'
  | 'error.invalidInput'
  | 'error.unsupportedOtpType'
  | 'error.missingSecret'
  | 'error.missingCounter'
  | 'error.invalidLastPassPayload'
  | 'error.lastPassDecodeFailed'
  | 'error.unsupportedQrFormat'
  | 'error.missingDataParam'
  | 'error.unsupportedFileType'
  | 'log.noQrFound'
  | 'log.noSecrets'
  | 'log.noSecretsInQr'
  | 'log.alreadyProcessedQr'
  | 'log.manualInput'
  | 'log.cameraScan'
  | 'log.extracted'
  | 'log.duplicatesSkipped'
  | 'export.noSelection'
  | 'export.scanLastPass'
  | 'export.scanGoogle'
  | 'export.lastPassMixedWarning'
  | 'export.noCompatibleLastPass'
  | 'copy.content'
  | 'copy.copied'
  | 'copy.failed'
  | 'notAvailable'
  | 'alert.closeLabel';

type Dictionary = Record<TranslationKey, string>;

const en: Dictionary = {
  'app.title': 'One-Time Password Secret Extractor',
  'tab.what': 'What is this?',
  'tab.how': 'How do I use it?',
  'tab.faq': 'FAQ',
  'tab.what.content':
    '<p>This tool extracts One-Time Password secrets from the Google Authenticator or LastPass Authenticator apps. There is no software to install, and no data ever leaves your device.</p><p><strong>All processing of your QR codes and secrets happens entirely offline, locally, right here in your browser.</strong></p>',
  'tab.use.content':
    `<p>This tool reads QR codes from Google Authenticator or LastPass Authenticator's export feature and gives you back the original secret for each account. You can then use these secrets to import your accounts into any other authenticator app.</p>
<h3>1. Export from your One-Time Password App</h3>
<h4>Export from Google Authenticator</h4>
<ul>
  <li>Open the Google Authenticator app on your phone.</li>
  <li>Go to the menu and select "Transfer accounts" &gt; "Export accounts".</li>
  <li>Select the accounts you wish to export.</li>
</ul>
<h4>Export from LastPass</h4>
<ul>
  <li>Open the LastPass Authenticator on your phone.</li>
  <li>Click on the cog and select "Transfer accounts" &gt; "Export accounts to QR code".</li>
  <li>For lastpass, you can also choose "Export accounts to file" and import that instead. This tool supports both formats.</li>
</ul>
<h3>2. Extract Secrets</h3>
<ul>
  <li>Click "Scan QR" to scan codes directly using a second device.</li>
  <li>Alternatively, take a screenshot of each QR code that is displayed, then click "Select QR Code Image(s)" or drag and drop your screenshot(s) onto the page.</li>
  <li>You can also enter a secret directly as text, and this tool will display your original setup QR code.</li>
</ul>
<h3>3. Use Your Secrets</h3>
<ul>
  <li>The tool will display the extracted OTP secrets, each with its own QR code and secret key.</li>
  <li>You can now import these secrets into your preferred authenticator app or password manager.</li>
</ul>`,
  'faq.1.title': 'Why is this needed?',
  'faq.1.answer':
    '<p>Google Authenticator lets you transfer your accounts to a new phone, but it does not provide an easy way to export them to other apps like 1Password or Bitwarden. This is because it hides the original "secret" (the QR code you first scanned) for each account.</p><p>Without these secrets, moving to a new password manager means manually re-configuring 2FA for every single account, which is a huge pain.</p><p>While other tools exist to solve this, they often require technical steps like running scripts or installing software. This tool is designed to be a simple, secure solution that anyone can use.</p>',
  'faq.2.title': 'How does it work?',
  'faq.2.answer':
    "<p>You provide screenshots of the QR codes from Google Authenticator's export feature. This tool reads those QR codes&mdash;right here in your browser&mdash;and gives you back the original secret for each account. You can then use these secrets to import your accounts into any other authenticator app.</p>",
  'faq.3.title': 'Is it safe to "upload" my QR codes?',
  'faq.3.answer':
    '<p>Yes. Security and privacy are the top priorities. <strong>Nothing you do here ever leaves your computer or mobile device.</strong> All processing happens locally, offline, right in your browser. Your QR code images and secrets are never sent to any server.</p><p>This tool is open-source and <a href="https://github.com/mfcarroll/extract-otp-web" target="_blank" rel="noopener noreferrer">the code can be inspected by anyone</a>, to verify its safety and methodology. It is hosted on GitHub pages, providing a <a href="https://github.com/mfcarroll/extract-otp-web/deployments/github-pages" target="_blank" rel="noopener noreferrer">secure and transparent deployment process</a>.</p>',
  'faq.4.title': "Why doesn't Google Authenticator show my original QR codes?",
  'faq.4.answer':
    '<p>Google Authenticator makes it difficult to view the original secrets used to set up your accounts. Instead, they provide an export QR code that bundles all your accounts together. This makes it easy to transfer to a new device, but difficult to switch to a different authenticator app. LastPass does provide individual QR codes for each account, which is a huge improvement, but it only provides the text secrets in a JSON code format. In contrast, apps like 1Password make the original secrets easily accessible, allowing for simple transfers to other 2FA apps.</p>',
  'faq.5.title': "Why can't 1Password import from Google Authenticator?",
  'faq.5.answer':
    `<p>That's a great question, and one that <a href="https://www.1password.community/discussions/1password/import-all-google-authenticator-2fas-to-1password/38418" target="_blank" rel="noopener noreferrer">others</a>, have <a href="https://www.reddit.com/r/1Password/comments/qm8v2i/add_existing_2fa_to_1password/" target="_blank" rel="noopener noreferrer">asked</a>. One reason given is a concern that Google's export format might change. However, this format has been stable for years, and other apps (like <a href="https://getaegis.app/" target="_blank" rel="noopener noreferrer">Aegis Authenticator</a>) support it without issue. It seems password managers like 1Password <em>could</em> easily support direct imports, but have chosen not to.</p>`,
  'faq.6.title': "My LastPass QR code won't scan!",
  'faq.6.answer':
    "<p>LastPass puts all of your accounts together into one QR code, and if you have many accounts this can make the QR code details tiny and hard to read. Google Authenticator works around this issue by providing more than one code, each containing a few accounts. Luckily, LastPass allows you to export a json file, which this tool can also read. If you're having problems with LastPass, just save the json file and import that instead.</p>",
  'faq.7.title': 'Who made this?',
  'faq.7.answer':
    '<p>This tool was created by <a href="https://www.linkedin.com/in/matthewfcarroll/" rel="noopener noreferrer" target="_blank">Matthew Carroll</a>, a developer who was frustrated with the process of migrating OTP codes from Google Authenticator into 1Password.</p>',
  'faq.8.title': 'How do I report a problem?',
  'faq.8.answer':
    '<p>Please report any issues with this tool on <a href="https://github.com/mfcarroll/extract-otp-web/issues" rel="noopener noreferrer" target="_blank">GitHub</a>.</p>',
  'faq.9.title': 'Acknowledgements',
  'faq.9.answer':
    `<p>This tool builds on the work of several open-source projects, including:</p>
<ul>
  <li><a href="https://github.com/scito/extract_otp_secrets/#readme" target="_blank" rel="noopener noreferrer">Extract OTP Secrets</a>, the python script by <a href="https://scito.ch/" target="_blank" rel="noopener noreferrer">Roland Kurmann</a>, on which this tool is based.</li>
  <li><a href="https://github.com/beemdevelopment/Aegis/#readme" target="_blank" rel="noopener noreferrer">Aegis Authenticator</a> and <a href="https://github.com/qistoph/otp_export/#readme" target="_blank" rel="noopener noreferrer">Chris van Marle</a>, for the export protobuf specification.</li>
  <li><a href="https://github.com/krissrex/google-authenticator-exporter/#readme" target="_blank" rel="noopener noreferrer">Google Authenticator Exporter</a>, another python script solution to the same problem.</li>
</ul>
<p>The user interface and QR code processing are powered by these open-source libraries:</p>
<ul>
  <li><a href="https://github.com/cozmo/jsQR#readme" target="_blank" rel="noopener noreferrer">jsQR</a> for decoding QR codes from images.</li>
  <li><a href="https://github.com/nodeca/pica#readme" target="_blank" rel="noopener noreferrer">pica</a> for high-quality image resizing.</li>
  <li><a href="https://github.com/nimiq/qr-scanner/#readme" target="_blank" rel="noopener noreferrer">QR Scanner</a> for scanning QR codes using the camera.</li>
  <li><a href="https://github.com/protobufjs/protobuf.js#readme" target="_blank" rel="noopener noreferrer">protobuf.js</a> for decoding the Google Authenticator data payload.</li>
  <li><a href="https://github.com/soldair/node-qrcode#readme" target="_blank" rel="noopener noreferrer">node-qrcode</a> for generating new QR codes for each account.</li>
  <li><a href="https://github.com/wzrdtales/thirty-two" target="_blank" rel="noopener noreferrer">thirty-two</a> for Base32 encoding the OTP secrets.</li>
  <li><a href="https://github.com/FortAwesome/Font-Awesome#readme" target="_blank" rel="noopener noreferrer">Font Awesome</a> for the icons used in the UI.</li>
</ul>
<p>Thank you to all the contributers to these excellent projects!</p>
<p><a href="https://codeassist.google.com/" target="_blank" rel="noopener noreferrer">Gemini Code Assist</a> was used during the development of this tool. All AI-generated code has been carefully manually reviewed.</p>`,
  'btn.scanQr': 'Scan QR',
  'btn.openFiles': 'Open File(s)',
  'btn.enterCode': 'Enter Code',
  'drop.hint': 'or drag and drop files here<br />(image, json export, csv, or txt)',
  'field.name': 'Name:',
  'field.issuer': 'Issuer:',
  'field.type': 'Type:',
  'field.counter': 'Counter:',
  'field.secret': 'Secret:',
  'field.url': 'URL:',
  'a11y.copyHint': 'Press Enter or Space to copy.',
  'a11y.copySecret': 'Copy secret',
  'a11y.copyUrl': 'Copy URL',
  'a11y.showLargerQr': 'Show larger QR code',
  'a11y.tapToEnlarge': 'Tap to enlarge',
  'selection.none': 'Select None',
  'selection.all': 'Select All',
  'selection.reset': 'Reset',
  'selection.count': '{{count}} of {{total}} selected',
  'btn.saveCsv': 'Save as CSV',
  'btn.saveJson': 'Save as JSON',
  'btn.exportGoogle': 'Export to Google',
  'btn.exportLastPass': 'Export to LastPass',
  'modal.scanQr': 'Scan QR Code',
  'modal.enterCode': 'Enter OTP Code',
  'modal.manualHelp':
    'Paste an <code>otpauth://</code> URL or a raw Base32 secret key (e.g., <code>JBSW Y3DP EHPK 3PXP</code>).',
  'modal.manualPlaceholder': 'Secret key or URL...',
  'btn.cancel': 'Cancel',
  'btn.addCode': 'Add Code',
  'footer.sourceCode': 'Source Code',
  'theme.openSwitcher': 'Open theme switcher',
  'theme.system': 'Switch to system theme',
  'theme.light': 'Switch to light theme',
  'theme.dark': 'Switch to dark theme',
  'lang.toggleTo': '中文',
  'error.unexpected':
    'An unexpected error occurred. Please try again or refresh the page.',
  'error.unknown': 'An unknown error occurred.',
  'error.processFiles': 'An unexpected error occurred while processing files.',
  'error.exportFailed': 'An unknown error occurred during export.',
  'error.noCamera': 'No camera found. Please ensure you have a camera connected.',
  'error.startCamera':
    'Failed to start camera. Please ensure you have a camera connected and have granted permission.',
  'error.switchCamera': 'Failed to switch camera.',
  'error.cameraProcess': 'Failed to process QR code from camera feed.',
  'error.invalidJson':
    'Invalid JSON format: Expected an array of OTP accounts or a LastPass export object.',
  'error.invalidInput':
    'Input must be a valid OTP URL, LastPass JSON, or a Base32 secret (letters A-Z, numbers 2-7).',
  'error.unsupportedOtpType': 'Unsupported OTP type in URL: {{type}}',
  'error.missingSecret': "Missing 'secret' parameter in otpauth URL.",
  'error.missingCounter':
    "Missing 'counter' parameter for hotp type in otpauth URL.",
  'error.invalidLastPassPayload':
    "Invalid LastPass QR code: 'content' property not found in payload.",
  'error.lastPassDecodeFailed':
    'Failed to decode LastPass QR code. The data format is not recognized or is corrupted.',
  'error.unsupportedQrFormat': 'QR code is not a supported format.',
  'error.missingDataParam': 'Invalid OTP URL: Missing "data" parameter.',
  'error.unsupportedFileType': 'Unsupported file type.',
  'log.noQrFound': 'No QR code found.',
  'log.noSecrets': 'No OTP secrets found.',
  'log.noSecretsInQr': 'No OTP secrets found in QR code.',
  'log.alreadyProcessedQr': 'QR code already processed.',
  'log.manualInput': 'Manual Input',
  'log.cameraScan': 'Camera Scan',
  'log.extracted': '{{count}} secret{{plural}} extracted.',
  'log.duplicatesSkipped': '{{count}} duplicate secret{{plural}} skipped.',
  'export.noSelection': 'No accounts selected to export.',
  'export.scanLastPass': 'Scan with LastPass Authenticator',
  'export.scanGoogle': 'Scan with Google Authenticator',
  'export.lastPassMixedWarning':
    'LastPass only supports time-based (TOTP) accounts. {{countText}} incompatible counter-based account{{pluralVerb}} removed from your selection. Click "Export to LastPass" again to continue.',
  'export.noCompatibleLastPass':
    'No compatible (TOTP) accounts selected for LastPass export.',
  'copy.content': 'Content',
  'copy.copied': '{{subject}} copied to clipboard.',
  'copy.failed': 'Failed to copy to clipboard.',
  notAvailable: 'Not available',
  'alert.closeLabel': 'Close {{type}} message',
};

const zhCN: Dictionary = {
  ...en,
  'app.title': '一次性密码密钥提取器',
  'tab.what': '这是什么？',
  'tab.how': '怎么使用？',
  'tab.faq': '常见问题',
  'tab.what.content':
    '<p>这个工具可以从 Google Authenticator 或 LastPass Authenticator 的导出数据中提取一次性密码（OTP）密钥。无需安装软件，数据不会离开你的设备。</p><p><strong>二维码和密钥的处理全部在你的浏览器本地离线完成。</strong></p>',
  'tab.use.content':
    `<p>这个工具会读取 Google Authenticator 或 LastPass Authenticator 导出的二维码，并还原每个账号的原始密钥。随后你可以将这些密钥导入其他认证器应用。</p>
<h3>1. 从 OTP 应用导出</h3>
<h4>Google Authenticator</h4>
<ul>
  <li>在手机上打开 Google Authenticator。</li>
  <li>进入菜单，选择“转移账号” &gt; “导出账号”。</li>
  <li>勾选你要导出的账号。</li>
</ul>
<h4>LastPass Authenticator</h4>
<ul>
  <li>打开 LastPass Authenticator。</li>
  <li>点击设置图标，选择“转移账号” &gt; “导出账号到二维码”。</li>
  <li>LastPass 也支持“导出账号到文件”，本工具同样支持导入该格式。</li>
</ul>
<h3>2. 提取密钥</h3>
<ul>
  <li>点击“扫描二维码”，用另一台设备直接扫描。</li>
  <li>或者先截图导出二维码，再点击“打开文件”或直接拖拽图片到页面。</li>
  <li>也可以直接输入密钥文本，工具会生成对应的原始配置二维码。</li>
</ul>
<h3>3. 使用密钥</h3>
<ul>
  <li>工具会展示每个账号提取出的 OTP 密钥和对应二维码。</li>
  <li>你可以将这些密钥导入你偏好的认证器或密码管理器。</li>
</ul>`,
  'faq.1.title': '为什么需要这个工具？',
  'faq.1.answer':
    '<p>Google Authenticator 虽然支持迁移账号到新手机，但并不方便导出到 1Password、Bitwarden 等其他应用，因为它隐藏了最初用于配置的“原始密钥”（即首次扫描的二维码内容）。</p><p>如果拿不到这些密钥，迁移到新密码管理器就要逐个网站重新配置 2FA，非常麻烦。</p><p>虽然已有一些解决方案，但通常需要脚本或安装软件。这个工具的目标是：简单、安全、人人可用。</p>',
  'faq.2.title': '它是如何工作的？',
  'faq.2.answer':
    '<p>你提供 Google Authenticator 导出的二维码截图后，工具会在浏览器本地解析二维码并还原每个账号的原始密钥，然后你就可以导入任意其他认证器应用。</p>',
  'faq.3.title': '“上传”二维码安全吗？',
  'faq.3.answer':
    '<p>安全。隐私和安全是第一优先。<strong>你在这里的所有操作都不会离开你的设备。</strong> 所有处理都在浏览器本地离线完成，二维码和密钥不会发送到任何服务器。</p><p>项目是开源的，你可以查看 <a href="https://github.com/mfcarroll/extract-otp-web" target="_blank" rel="noopener noreferrer">源码</a> 验证实现方式。部署在 GitHub Pages，也有可审计的 <a href="https://github.com/mfcarroll/extract-otp-web/deployments/github-pages" target="_blank" rel="noopener noreferrer">公开发布流程</a>。</p>',
  'faq.4.title': '为什么 Google Authenticator 不显示原始二维码？',
  'faq.4.answer':
    '<p>Google Authenticator 不容易查看原始密钥，而是提供一个打包多个账号的导出二维码。这对换机很方便，但对迁移到其他认证器并不友好。LastPass 会给每个账号单独二维码，这是进步，但文本密钥主要在 JSON 中提供。相比之下，像 1Password 这类应用更容易查看原始密钥，迁移更简单。</p>',
  'faq.5.title': '为什么 1Password 不能直接导入 Google Authenticator？',
  'faq.5.answer':
    `<p>这是很多人都问过的问题，例如 <a href="https://www.1password.community/discussions/1password/import-all-google-authenticator-2fas-to-1password/38418" target="_blank" rel="noopener noreferrer">社区讨论</a> 和 <a href="https://www.reddit.com/r/1Password/comments/qm8v2i/add_existing_2fa_to_1password/" target="_blank" rel="noopener noreferrer">Reddit 讨论</a>。一种说法是担心 Google 导出格式会变，但这个格式多年比较稳定，像 <a href="https://getaegis.app/" target="_blank" rel="noopener noreferrer">Aegis</a> 也能稳定支持。理论上主流密码管理器并非做不到。</p>`,
  'faq.6.title': 'LastPass 二维码扫不出来怎么办？',
  'faq.6.answer':
    '<p>LastPass 常把所有账号塞进一个二维码，账号多时二维码细节会过小，导致难以识别。Google Authenticator 会分成多个二维码来缓解。好消息是 LastPass 支持导出 JSON 文件，本工具也支持导入；如果扫码困难，建议改用 JSON 文件导入。</p>',
  'faq.7.title': '这个工具是谁做的？',
  'faq.7.answer':
    '<p>由 <a href="https://www.linkedin.com/in/matthewfcarroll/" rel="noopener noreferrer" target="_blank">Matthew Carroll</a> 开发。他在把 OTP 从 Google Authenticator 迁移到 1Password 时感到流程太繁琐，于是做了这个工具。</p>',
  'faq.8.title': '怎么反馈问题？',
  'faq.8.answer':
    '<p>请在 <a href="https://github.com/mfcarroll/extract-otp-web/issues" rel="noopener noreferrer" target="_blank">GitHub Issues</a> 提交问题。</p>',
  'faq.9.title': '致谢',
  'faq.9.answer':
    `<p>本工具基于多个开源项目，包括：</p>
<ul>
  <li><a href="https://github.com/scito/extract_otp_secrets/#readme" target="_blank" rel="noopener noreferrer">Extract OTP Secrets</a>（Roland Kurmann 的 Python 脚本，本项目的重要基础）。</li>
  <li><a href="https://github.com/beemdevelopment/Aegis/#readme" target="_blank" rel="noopener noreferrer">Aegis Authenticator</a> 与 <a href="https://github.com/qistoph/otp_export/#readme" target="_blank" rel="noopener noreferrer">Chris van Marle</a>（Google 导出 protobuf 规范）。</li>
  <li><a href="https://github.com/krissrex/google-authenticator-exporter/#readme" target="_blank" rel="noopener noreferrer">Google Authenticator Exporter</a>（另一个 Python 方案）。</li>
</ul>
<p>界面与二维码处理也使用了优秀的开源库：</p>
<ul>
  <li><a href="https://github.com/cozmo/jsQR#readme" target="_blank" rel="noopener noreferrer">jsQR</a></li>
  <li><a href="https://github.com/nodeca/pica#readme" target="_blank" rel="noopener noreferrer">pica</a></li>
  <li><a href="https://github.com/nimiq/qr-scanner/#readme" target="_blank" rel="noopener noreferrer">QR Scanner</a></li>
  <li><a href="https://github.com/protobufjs/protobuf.js#readme" target="_blank" rel="noopener noreferrer">protobuf.js</a></li>
  <li><a href="https://github.com/soldair/node-qrcode#readme" target="_blank" rel="noopener noreferrer">node-qrcode</a></li>
  <li><a href="https://github.com/wzrdtales/thirty-two" target="_blank" rel="noopener noreferrer">thirty-two</a></li>
  <li><a href="https://github.com/FortAwesome/Font-Awesome#readme" target="_blank" rel="noopener noreferrer">Font Awesome</a></li>
</ul>
<p>感谢所有贡献者！</p>
<p>开发过程中使用了 <a href="https://codeassist.google.com/" target="_blank" rel="noopener noreferrer">Gemini Code Assist</a>，所有 AI 生成代码都已人工审阅。</p>`,
  'btn.scanQr': '扫描二维码',
  'btn.openFiles': '打开文件',
  'btn.enterCode': '手动输入',
  'drop.hint': '或将文件拖拽到这里<br />(图片、json 导出、csv 或 txt)',
  'field.name': '名称：',
  'field.issuer': '签发方：',
  'field.type': '类型：',
  'field.counter': '计数器：',
  'field.secret': '密钥：',
  'field.url': '链接：',
  'a11y.copyHint': '按 Enter 或空格键复制。',
  'a11y.copySecret': '复制密钥',
  'a11y.copyUrl': '复制链接',
  'a11y.showLargerQr': '查看放大二维码',
  'a11y.tapToEnlarge': '点击放大',
  'selection.none': '全不选',
  'selection.all': '全选',
  'selection.reset': '重置',
  'selection.count': '已选择 {{count}} / {{total}}',
  'btn.saveCsv': '保存为 CSV',
  'btn.saveJson': '保存为 JSON',
  'btn.exportGoogle': '导出到 Google',
  'btn.exportLastPass': '导出到 LastPass',
  'modal.scanQr': '扫描二维码',
  'modal.enterCode': '输入 OTP 代码',
  'modal.manualHelp':
    '可粘贴 <code>otpauth://</code> 链接，或直接粘贴 Base32 密钥（例如 <code>JBSW Y3DP EHPK 3PXP</code>）。',
  'modal.manualPlaceholder': '密钥或 URL...',
  'btn.cancel': '取消',
  'btn.addCode': '添加',
  'footer.sourceCode': '源码',
  'theme.openSwitcher': '打开主题切换器',
  'theme.system': '切换为系统主题',
  'theme.light': '切换为浅色主题',
  'theme.dark': '切换为深色主题',
  'lang.toggleTo': 'EN',
  'error.unexpected': '发生了意外错误，请重试或刷新页面。',
  'error.unknown': '发生未知错误。',
  'error.processFiles': '处理文件时发生意外错误。',
  'error.exportFailed': '导出时发生未知错误。',
  'error.noCamera': '未检测到摄像头，请确认设备已连接摄像头。',
  'error.startCamera': '无法启动摄像头，请确认已连接摄像头并已授权访问。',
  'error.switchCamera': '切换摄像头失败。',
  'error.cameraProcess': '处理摄像头二维码失败。',
  'error.invalidJson': 'JSON 格式无效：应为 OTP 数组或 LastPass 导出对象。',
  'error.invalidInput':
    '输入内容必须是有效 OTP URL、LastPass JSON，或 Base32 密钥（A-Z 与 2-7）。',
  'error.unsupportedOtpType': 'URL 中的 OTP 类型不受支持：{{type}}',
  'error.missingSecret': "otpauth URL 缺少 'secret' 参数。",
  'error.missingCounter': "hotp 类型的 otpauth URL 缺少 'counter' 参数。",
  'error.invalidLastPassPayload':
    "LastPass 二维码无效：负载中缺少 'content' 字段。",
  'error.lastPassDecodeFailed':
    '无法解析 LastPass 二维码，数据格式无法识别或已损坏。',
  'error.unsupportedQrFormat': '二维码格式不受支持。',
  'error.missingDataParam': 'OTP URL 无效：缺少 "data" 参数。',
  'error.unsupportedFileType': '不支持的文件类型。',
  'log.noQrFound': '未识别到二维码。',
  'log.noSecrets': '未找到 OTP 密钥。',
  'log.noSecretsInQr': '二维码中未找到 OTP 密钥。',
  'log.alreadyProcessedQr': '该二维码已处理过。',
  'log.manualInput': '手动输入',
  'log.cameraScan': '摄像头扫描',
  'log.extracted': '已提取 {{count}} 条密钥。',
  'log.duplicatesSkipped': '已跳过 {{count}} 条重复密钥。',
  'export.noSelection': '未选择要导出的账号。',
  'export.scanLastPass': '请使用 LastPass Authenticator 扫描',
  'export.scanGoogle': '请使用 Google Authenticator 扫描',
  'export.lastPassMixedWarning':
    'LastPass 仅支持基于时间的 TOTP 账号。已从你的选择中移除 {{countText}} 个不兼容的计数器型账号。请再次点击“导出到 LastPass”继续。',
  'export.noCompatibleLastPass': '未选择可导出的 TOTP 账号（LastPass 仅支持 TOTP）。',
  'copy.content': '内容',
  'copy.copied': '{{subject}}已复制到剪贴板。',
  'copy.failed': '复制到剪贴板失败。',
  notAvailable: '不可用',
  'alert.closeLabel': '关闭{{type}}消息',
};

const dictionaries: Record<Language, Dictionary> = {
  en,
  'zh-CN': zhCN,
};

let currentLanguage: Language = 'en';
const listeners = new Set<(language: Language) => void>();

function normalizeLanguage(value: string | null | undefined): Language {
  if (!value) return 'en';
  return value.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) =>
    vars[key] === undefined ? '' : String(vars[key])
  );
}

function setText(selector: string, text: string): void {
  const element = document.querySelector<HTMLElement>(selector);
  if (element) element.textContent = text;
}

function setHtml(selector: string, html: string): void {
  const element = document.querySelector<HTMLElement>(selector);
  if (element) element.innerHTML = html;
}

function setAttr(selector: string, attr: string, value: string): void {
  const element = document.querySelector<HTMLElement>(selector);
  if (element) element.setAttribute(attr, value);
}

function setButtonWithIcon(selector: string, iconClass: string, text: string): void {
  const element = document.querySelector<HTMLElement>(selector);
  if (element) {
    element.innerHTML = `<i class="${iconClass}"></i> ${text}`;
  }
}

function applyStaticTranslations(): void {
  setText('h1', t('app.title'));
  setText('#tab-btn-what', t('tab.what'));
  setText('#tab-btn-use', t('tab.how'));
  setText('#tab-btn-faq', t('tab.faq'));
  setHtml('#tab-what', t('tab.what.content'));
  setHtml('#tab-use', t('tab.use.content'));
  setText('#faq-1-button .faq-title', t('faq.1.title'));
  setHtml('#faq-1-answer', t('faq.1.answer'));
  setText('#faq-2-button .faq-title', t('faq.2.title'));
  setHtml('#faq-2-answer', t('faq.2.answer'));
  setText('#faq-3-button .faq-title', t('faq.3.title'));
  setHtml('#faq-3-answer', t('faq.3.answer'));
  setText('#faq-4-button .faq-title', t('faq.4.title'));
  setHtml('#faq-4-answer', t('faq.4.answer'));
  setText('#faq-5-button .faq-title', t('faq.5.title'));
  setHtml('#faq-5-answer', t('faq.5.answer'));
  setText('#faq-6-button .faq-title', t('faq.6.title'));
  setHtml('#faq-6-answer', t('faq.6.answer'));
  setText('#faq-7-button .faq-title', t('faq.7.title'));
  setHtml('#faq-7-answer', t('faq.7.answer'));
  setText('#faq-8-button .faq-title', t('faq.8.title'));
  setHtml('#faq-8-answer', t('faq.8.answer'));
  setText('#faq-9-button .faq-title', t('faq.9.title'));
  setHtml('#faq-9-answer', t('faq.9.answer'));
  setButtonWithIcon('#btn-scan-qr', 'fa fa-camera', t('btn.scanQr'));
  setButtonWithIcon('.file-input-buttons .btn[onclick]', 'fa fa-upload', t('btn.openFiles'));
  setButtonWithIcon('#btn-manual-entry', 'fa fa-pen-to-square', t('btn.enterCode'));
  setHtml('.drop-text', t('drop.hint'));

  setText('.detail-row [data-value="name"]', '');
  setText('.detail-row [data-value="issuer"]', '');
  setText('.detail-row [data-value="type"]', '');
  setText('.detail-row [data-value="counter"]', '');

  setText('#selection-count', t('selection.count', { count: 0, total: 0 }));
  setText('#select-all-button', t('selection.all'));
  setText('#deselect-all-button', t('selection.none'));
  setButtonWithIcon('#clear-all-button', 'fa fa-trash', t('selection.reset'));
  setButtonWithIcon('#download-csv-button', 'fa fa-download', t('btn.saveCsv'));
  setButtonWithIcon('#download-json-button', 'fa fa-download', t('btn.saveJson'));
  setButtonWithIcon('#export-google-button', 'fa-brands fa-google', t('btn.exportGoogle'));
  setButtonWithIcon('#export-lastpass-button', 'fa-solid fa-key', t('btn.exportLastPass'));

  setText('#camera-title', t('modal.scanQr'));
  setText('#manual-modal-title', t('modal.enterCode'));
  setHtml('#manual-modal .modal-body p', t('modal.manualHelp'));
  setAttr('#manual-otp-input', 'placeholder', t('modal.manualPlaceholder'));
  setText('#manual-otp-cancel', t('btn.cancel'));
  setText('#manual-otp-submit', t('btn.addCode'));
  setText('#source-code-link', t('footer.sourceCode'));

  setText('#theme-switcher-wrapper .visually-hidden', t('theme.openSwitcher'));
  setText('button[data-theme="system"] .visually-hidden', t('theme.system'));
  setText('button[data-theme="light"] .visually-hidden', t('theme.light'));
  setText('button[data-theme="dark"] .visually-hidden', t('theme.dark'));

  setText('#lang-toggle-button', t('lang.toggleTo'));

  setText('.secret-row .label', t('field.secret'));
  setText('.otp-url-row .label', t('field.url'));
  setText('.counter-row .label', t('field.counter'));
  setText('.detail-row .label', t('field.name'));
  const issuerLabel = document.querySelectorAll<HTMLElement>('.detail-row .label');
  if (issuerLabel[1]) issuerLabel[1].textContent = t('field.issuer');
  if (issuerLabel[2]) issuerLabel[2].textContent = t('field.type');

  setText('.card-actions-help', t('a11y.copyHint'));
  setText('.secret-container .copy-button .visually-hidden', t('a11y.copySecret'));
  setText('.otp-url-container .copy-button .visually-hidden', t('a11y.copyUrl'));
  setText('.qr-code-container .visually-hidden', t('a11y.showLargerQr'));
  setText('.qr-enlarge-hint', t('a11y.tapToEnlarge'));
}

function updateLangButtonAria(): void {
  const button = document.getElementById('lang-toggle-button');
  if (!button) return;
  button.setAttribute(
    'aria-label',
    currentLanguage === 'en' ? 'Switch language to Chinese' : '切换语言为英文'
  );
}

function attachLanguageToggle(): void {
  const button = document.getElementById('lang-toggle-button');
  if (!button || button.getAttribute('data-i18n-bound') === 'true') return;
  button.setAttribute('data-i18n-bound', 'true');
  button.addEventListener('click', () => {
    setLanguage(currentLanguage === 'en' ? 'zh-CN' : 'en');
  });
}

export function t(
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  const dictionary = dictionaries[currentLanguage];
  return interpolate(dictionary[key], vars);
}

export function getCurrentLanguage(): Language {
  return currentLanguage;
}

export function onLanguageChange(listener: (language: Language) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLanguage(language: Language): void {
  currentLanguage = language;
  localStorage.setItem('language', language);
  document.documentElement.setAttribute('lang', language === 'zh-CN' ? 'zh-CN' : 'en');
  applyStaticTranslations();
  updateLangButtonAria();
  listeners.forEach((listener) => listener(currentLanguage));
}

export function initI18n(): void {
  attachLanguageToggle();
  const savedRaw = localStorage.getItem('language');
  const savedLanguage = savedRaw ? normalizeLanguage(savedRaw) : null;
  const browserLanguage = normalizeLanguage(navigator.language);
  const initialLanguage = savedLanguage || browserLanguage;
  setLanguage(initialLanguage);
}

