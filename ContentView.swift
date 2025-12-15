import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = IPSWViewModel()
    @State private var showToast: Bool = false
    @State private var toastMessage: String = ""
    
    // 背景動畫變數
    @State private var animateBlob1 = false
    @State private var animateBlob2 = false
    
    var body: some View {
        ZStack {
            // === 1. 背景層 (深海液態流動) ===
            Color(hex: "050510").ignoresSafeArea()
            
            // 流動光球
            Circle()
                .fill(Color.cyan.opacity(0.2))
                .frame(width: 400, height: 400)
                .blur(radius: 100)
                .offset(x: animateBlob1 ? -150 : -250, y: animateBlob1 ? -100 : -200)
                .animation(.easeInOut(duration: 10).repeatForever(autoreverses: true), value: animateBlob1)
            
            Circle()
                .fill(Color.purple.opacity(0.2))
                .frame(width: 350, height: 350)
                .blur(radius: 80)
                .offset(x: animateBlob2 ? 200 : 150, y: animateBlob2 ? 150 : 250)
                .animation(.easeInOut(duration: 8).repeatForever(autoreverses: true), value: animateBlob2)
            
            VStack(spacing: 25) {
                // === 標題區 ===
                headerView
                
                // === 狀態區 ===
                statusSection
                
                // === 玻璃操作面板 ===
                operationSection
                
                // === 結果區 ===
                resultSection
                
                if let error = viewModel.errorMessage {
                    Text(error).foregroundStyle(.red.opacity(0.8)).font(.caption)
                }
            }
            .padding(30)
            
            // 浮動 Toast
            if showToast {
                toastView
            }
        }
        .frame(minWidth: 550, minHeight: 750)
        .onAppear {
            animateBlob1 = true
            animateBlob2 = true
        }
        .task {
            await viewModel.fetchInitialData()
        }
    }
}

// 將各個區塊拆成 extension 讓 body 更乾淨
extension ContentView {
    
    private var headerView: some View {
        HStack {
            ZStack {
                Circle().fill(LinearGradient(colors: [.cyan, .blue], startPoint: .top, endPoint: .bottom))
                    .frame(width: 40, height: 40)
                    .blur(radius: 5)
                Image(systemName: "arrow.down.circle.dotted")
                    .font(.system(size: 30))
                    .foregroundStyle(.white)
            }
            
            VStack(alignment: .leading, spacing: 0) {
                Text("IPSW Finder")
                    .font(.system(size: 22, weight: .heavy, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(colors: [.white, .white.opacity(0.7)], startPoint: .top, endPoint: .bottom)
                    )
                Text("v3.0")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.cyan.opacity(0.8))
                    .tracking(1)
            }
            Spacer()
        }
        .padding(.horizontal, 10)
    }
    
    private var statusSection: some View {
        HStack(spacing: 12) {
            LiquidStatusCard(title: "iOS", version: viewModel.latestVersions["iOS"] ?? "--", icon: "iphone", color: .cyan)
            LiquidStatusCard(title: "iPadOS", version: viewModel.latestVersions["iPadOS"] ?? "--", icon: "ipad", color: .mint)
            LiquidStatusCard(title: "macOS", version: viewModel.latestVersions["macOS"] ?? "--", icon: "desktopcomputer", color: .purple)
        }
    }
    
    private var operationSection: some View {
        VStack(spacing: 20) {
            // 裝置切換
            HStack(spacing: 10) {
                LiquidTypeButton(title: "iPhone", icon: "iphone", isSelected: viewModel.selectedDeviceType == "iPhone") {
                    viewModel.selectedDeviceType = "iPhone"
                }
                LiquidTypeButton(title: "iPad", icon: "ipad", isSelected: viewModel.selectedDeviceType == "iPad") {
                    viewModel.selectedDeviceType = "iPad"
                }
                LiquidTypeButton(title: "Mac", icon: "desktopcomputer", isSelected: viewModel.selectedDeviceType == "Mac") {
                    viewModel.selectedDeviceType = "Mac"
                }
            }
            
            // 輸入與按鈕
            HStack(spacing: 12) {
                // 輸入框
                HStack {
                    Image(systemName: "magnifyingglass").foregroundStyle(.white.opacity(0.4))
                    TextField("輸入版本 (如 17.2)", text: $viewModel.versionInput)
                        .textFieldStyle(.plain)
                        .font(.system(size: 15))
                        .foregroundStyle(.white)
                        .onSubmit { Task { await viewModel.searchFirmware() } }
                }
                .padding(14)
                .background(Color.black.opacity(0.2))
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.1), lineWidth: 1))
                
                // 查詢按鈕
                Button(action: { Task { await viewModel.searchFirmware() } }) {
                    HStack {
                        if viewModel.isSearching {
                            ProgressView().controlSize(.small).tint(.white)
                        } else {
                            Image(systemName: "sparkles")
                        }
                        Text("查詢")
                            .fontWeight(.bold)
                    }
                    .padding(.vertical, 14)
                    .padding(.horizontal, 24)
                    .background(
                        LinearGradient(colors: [.cyan, .blue], startPoint: .topLeading, endPoint: .bottomTrailing)
                    )
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .shadow(color: .cyan.opacity(0.5), radius: 10)
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(.white.opacity(0.3), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(viewModel.isSearching)
            }
        }
        .padding(20)
        .liquidGlass(cornerRadius: 24)
    }
    
    private var resultSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("下載連結")
                    .font(.headline)
                    .foregroundStyle(.white.opacity(0.8))
                Spacer()
                
                if !viewModel.resultsText.isEmpty {
                    Button(action: {
                        let pasteboard = NSPasteboard.general
                        pasteboard.clearContents()
                        pasteboard.setString(viewModel.resultsText, forType: .string)
                        triggerToast(msg: "連結已複製到剪貼簿 📋")
                    }) {
                        HStack(spacing: 4) {
                            Image(systemName: "doc.on.doc")
                            Text("複製")
                        }
                        .font(.caption.bold())
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(.ultraThinMaterial)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(.white.opacity(0.2), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            
            TextEditor(text: .constant(viewModel.resultsText))
                .font(.system(.body, design: .monospaced))
                .foregroundStyle(.white)
                .scrollContentBackground(.hidden)
                .padding(5)
                .background(Color.black.opacity(0.2))
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .padding(4)
    }
    
    private var toastView: some View {
        VStack {
            Spacer()
            HStack(spacing: 12) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.cyan)
                    .font(.title3)
                Text(toastMessage)
                    .foregroundStyle(.white)
                    .fontWeight(.medium)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 14)
            .background(.ultraThinMaterial)
            .background(Color.black.opacity(0.4))
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(
                        LinearGradient(colors: [.white.opacity(0.5), .clear], startPoint: .top, endPoint: .bottom),
                        lineWidth: 1
                    )
            )
            .shadow(radius: 20)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .padding(.bottom, 40)
        }
        .zIndex(100)
    }
    
    func triggerToast(msg: String) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
            toastMessage = msg
            showToast = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            withAnimation { showToast = false }
        }
    }
}
