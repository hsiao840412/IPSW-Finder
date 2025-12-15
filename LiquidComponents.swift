import SwiftUI

// 1. 頂部狀態球
struct LiquidStatusCard: View {
    let title: String
    let version: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(color.opacity(0.8))
                    .shadow(color: color.opacity(0.5), radius: 5)
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.6))
            }
            Text(version)
                .font(.system(size: 16, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
        }
        .padding(15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .liquidGlass(cornerRadius: 16)
    }
}

// 2. 選擇按鈕 (水滴狀)
struct LiquidTypeButton: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                Text(title)
            }
            .font(.system(size: 13, weight: isSelected ? .bold : .medium))
            .padding(.vertical, 12)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity)
            .background(
                ZStack {
                    if isSelected {
                        LinearGradient(
                            colors: [Color.cyan.opacity(0.6), Color.blue.opacity(0.6)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        .blur(radius: 0)
                    } else {
                        Color.white.opacity(0.05)
                    }
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .strokeBorder(
                        isSelected ? .white.opacity(0.5) : .white.opacity(0.1),
                        lineWidth: 1
                    )
            )
            .shadow(color: isSelected ? .cyan.opacity(0.3) : .clear, radius: 8)
            .animation(.spring(), value: isSelected)
        }
        .buttonStyle(.plain)
    }
}
