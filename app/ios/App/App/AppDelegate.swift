import UIKit
import AVFoundation
import ActivityKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Quran audio keeps playing with the screen locked and ignores the silent switch (needs UIBackgroundModes=audio)
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        excludeDownloadsFromBackup()
        // a Live Activity left over from a previous run (app was killed while playing)
        if #available(iOS 16.2, *) { Task { for a in Activity<SakinaAyahAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) } } }
        return true
    }

    /// Downloaded recitations can be fetched again, so Apple asks that they are not backed up to iCloud (App Review 2.23).
    private func excludeDownloadsFromBackup() {
        guard let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else { return }
        var dir = docs.appendingPathComponent("audio", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try? dir.setResourceValues(values)
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        excludeDownloadsFromBackup()
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}


// MARK: - Live Activity: the ayah being recited, on the Lock Screen and in the Dynamic Island

/// Same definition as ios/App/SakinaWidget/SakinaLiveActivity.swift — keep both identical.
@available(iOS 16.1, *)
struct SakinaAyahAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var ayah: String      // the ayah being recited now ("" when not known)
        var surah: String
        var reciter: String
        var ayahNo: Int       // 0 when not known
        var playing: Bool
    }
    var title: String
}

/// JS: registerPlugin('LiveAyah').update({ ayah, surah, reciter, ayahNo, playing }) / .end()
@objc(LiveAyahPlugin)
public class LiveAyahPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveAyahPlugin"
    public let jsName = "LiveAyah"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise)
    ]

    @objc func isSupported(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) { call.resolve(["value": ActivityAuthorizationInfo().areActivitiesEnabled]) } else { call.resolve(["value": false]) }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        let ayah = String((call.getString("ayah") ?? "").prefix(900)) // ContentState must stay under 4 KB
        let state = SakinaAyahAttributes.ContentState(ayah: ayah, surah: call.getString("surah") ?? "", reciter: call.getString("reciter") ?? "", ayahNo: call.getInt("ayahNo") ?? 0, playing: call.getBool("playing") ?? true)
        Task {
            let content = ActivityContent(state: state, staleDate: nil)
            if let activity = Activity<SakinaAyahAttributes>.activities.first {
                await activity.update(content)
            } else if ActivityAuthorizationInfo().areActivitiesEnabled {
                // starting is only allowed while the app is in the foreground (playback always starts from a tap)
                _ = try? Activity.request(attributes: SakinaAyahAttributes(title: "سكينة"), content: content, pushType: nil)
            }
            call.resolve()
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        Task {
            for activity in Activity<SakinaAyahAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
            call.resolve()
        }
    }
}

/// Registers the app's own plugins (Main.storyboard points here instead of CAPBridgeViewController).
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(LiveAyahPlugin())
    }
}
