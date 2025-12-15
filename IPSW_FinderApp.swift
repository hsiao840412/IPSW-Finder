import SwiftUI

@main
struct IPSWFinderApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .navigationTitle("IPSW Finder") // 設定視窗標題
        }
        // 固定視窗大小，避免介面被拉伸得太奇怪
        .windowResizability(.contentSize)
    }
}
