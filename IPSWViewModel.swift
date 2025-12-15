import SwiftUI
import Combine

@MainActor
class IPSWViewModel: ObservableObject {
    @Published var latestVersions: [String: String] = [
        "iOS": "查詢中...", "iPadOS": "查詢中...", "macOS": "查詢中..."
    ]
    @Published var selectedDeviceType: String = "iPhone" {
        didSet { autofillVersion() }
    }
    @Published var versionInput: String = ""
    @Published var resultsText: String = ""
    @Published var isSearching: Bool = false
    @Published var errorMessage: String?
    
    private var cachedDevices: [DeviceBasic] = []
    
    // 初始化數據
    func fetchInitialData() async {
        do {
            let url = URL(string: "https://api.ipsw.me/v4/devices")!
            let (data, _) = try await URLSession.shared.data(from: url)
            let devices = try JSONDecoder().decode([DeviceBasic].self, from: data)
            self.cachedDevices = devices
            await updateLatestSystemVersions(allDevices: devices)
        } catch {
            self.errorMessage = "初始化失敗: \(error.localizedDescription)"
        }
    }
    
    // 取得最新系統版本
    func updateLatestSystemVersions(allDevices: [DeviceBasic]) async {
        let categories = ["iOS": "iPhone", "iPadOS": "iPad", "macOS": "Mac"]
        
        let updates = await withTaskGroup(of: (String, String).self) { group -> [String: String] in
            for (osName, keyword) in categories {
                let candidates = allDevices.filter { $0.name.contains(keyword) }
                
                group.addTask {
                    // 使用 Models 裡定義的 calculateGenerationNumber 進行設備排序 (例如 iPhone 14 > iPhone 13)
                    guard let latestDevice = candidates.sorted(by: {
                        calculateGenerationNumber(identifier: $0.identifier) < calculateGenerationNumber(identifier: $1.identifier)
                    }).last else { return (osName, "未知") }
                    
                    do {
                        let url = URL(string: "https://api.ipsw.me/v4/device/\(latestDevice.identifier)")!
                        let (data, _) = try await URLSession.shared.data(from: url)
                        let detail = try JSONDecoder().decode(DeviceDetail.self, from: data)
                        
                        // 使用 localizedStandardCompare 正確比較版本號 (例如 17.2 > 17.1.2)
                        if let maxFw = detail.firmwares.max(by: { $0.version.localizedStandardCompare($1.version) == .orderedAscending }) {
                            return (osName, maxFw.version)
                        }
                    } catch { print("Error fetching details for \(latestDevice.identifier): \(error)") }
                    
                    return (osName, "查無資料")
                }
            }
            
            var results = [String: String]()
            for await (os, version) in group { results[os] = version }
            return results
        }
        
        for (key, value) in updates { self.latestVersions[key] = value }
        self.autofillVersion()
    }
    
    // 自動填入版本號
    private func autofillVersion() {
        let map = ["iPhone": "iOS", "iPad": "iPadOS", "Mac": "macOS"]
        if let key = map[selectedDeviceType], let ver = latestVersions[key], ver != "查詢中...", ver != "查無資料" {
            versionInput = ver
        }
    }
    
    // 搜尋韌體連結
    func searchFirmware() async {
        guard !versionInput.isEmpty else { return }
        isSearching = true
        resultsText = ""
        errorMessage = nil
        
        do {
            let urlStr = "https://api.ipsw.me/v4/ipsw/\(versionInput)"
            guard let url = URL(string: urlStr) else { return }
            
            let (data, response) = try await URLSession.shared.data(from: url)
            
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 404 {
                resultsText = "找不到版本 \(versionInput) 的韌體。"
                isSearching = false
                return
            }
            
            let firmwares = try JSONDecoder().decode([FirmwareInfo].self, from: data)
            let typeKeyword = selectedDeviceType.lowercased()
            
            // 1. 篩選符合裝置類型的韌體
            let validFirmwares = firmwares.filter {
                guard let ident = $0.identifier?.lowercased() else { return false }
                
                if typeKeyword == "iphone" { return ident.contains("iphone") }
                if typeKeyword == "ipad" { return ident.contains("ipad") }
                if typeKeyword == "mac" { return ident.contains("mac") }
                return true
            }
            
            // 2. 取出 URL -> 轉成 Set 去除重複 -> 再轉回 Array 排序
            let uniqueLinks = Array(Set(validFirmwares.map { $0.url })).sorted()
            
            resultsText = uniqueLinks.isEmpty ? "找不到 \(selectedDeviceType) 的 \(versionInput) 韌體。" : uniqueLinks.joined(separator: "\n")
            
        } catch {
            errorMessage = "查詢錯誤: \(error.localizedDescription)"
        }
        isSearching = false
    }
}
