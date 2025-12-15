import Foundation

// 1. 定義 DeviceBasic
struct DeviceBasic: Codable, Identifiable {
    var id = UUID() // 改成 var 解決黃色警告
    let name: String
    let identifier: String
    
    // 忽略 id，只解析 API 回傳的欄位
    enum CodingKeys: String, CodingKey {
        case name, identifier
    }
}

// 2. 定義 DeviceDetail
struct DeviceDetail: Codable {
    let name: String
    let identifier: String
    let firmwares: [FirmwareInfo] // 這裡補上了缺少的 firmwares
}

// 3. 定義 FirmwareInfo
struct FirmwareInfo: Codable, Identifiable {
    var id = UUID()
    let identifier: String? // 這裡補上了 identifier (設為 Optional 以防萬一)
    let version: String
    let url: String
    let size: Int64?
    let releasedate: String?
    let uploaddate: String?
    let signed: Bool
    
    enum CodingKeys: String, CodingKey {
        case identifier, version, url, size, releasedate, uploaddate, signed
    }
}

// 4. 輔助函式：計算型號代碼數字 (例如 iPhone14,5 -> 14)
func calculateGenerationNumber(identifier: String) -> Int {
    let components = identifier.components(separatedBy: CharacterSet.decimalDigits.inverted)
    if let numberString = components.first(where: { !$0.isEmpty }), let number = Int(numberString) {
        return number
    }
    return 0
}
