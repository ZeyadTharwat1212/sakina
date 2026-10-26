import ActivityKit
import WidgetKit
import SwiftUI

/// Same definition as App/AppDelegate.swift — keep both identical (ActivityKit matches them by shape).
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

private let sakinaGreen = Color(red: 0.11, green: 0.29, blue: 0.24)
private let sakinaGold = Color(red: 0.69, green: 0.54, blue: 0.24)

/// Live Activity shown on the Lock Screen and in the Dynamic Island while the Quran plays:
/// the ayah being recited, the surah and the reciter.
struct SakinaAyahLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SakinaAyahAttributes.self) { context in
            AyahLockScreenView(state: context.state)
                .activityBackgroundTint(sakinaGreen.opacity(0.92))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: context.state.playing ? "waveform" : "pause.fill").foregroundStyle(sakinaGold)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.ayahNo > 0 { Text("\(context.state.ayahNo)").font(.caption.monospacedDigit()).foregroundStyle(.secondary) }
                }
                DynamicIslandExpandedRegion(.center) {
                    Text("سورة \(context.state.surah)").font(.caption).foregroundStyle(.secondary)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    AyahText(state: context.state, size: 17, lines: 3)
                }
            } compactLeading: {
                Image(systemName: "book.closed.fill").foregroundStyle(sakinaGold)
            } compactTrailing: {
                Text(context.state.ayahNo > 0 ? "\(context.state.ayahNo)" : context.state.surah).font(.caption2).lineLimit(1)
            } minimal: {
                Image(systemName: "book.closed.fill").foregroundStyle(sakinaGold)
            }
        }
    }
}

struct AyahText: View {
    let state: SakinaAyahAttributes.ContentState
    var size: CGFloat = 20
    var lines: Int = 4
    var body: some View {
        Group {
            if state.ayah.isEmpty {
                Text("سورة \(state.surah)").font(.system(size: size, weight: .semibold))
            } else {
                (Text("﴿").foregroundColor(sakinaGold) + Text(state.ayah) + Text("﴾").foregroundColor(sakinaGold))
                    .font(.system(size: size, weight: .medium))
            }
        }
        .multilineTextAlignment(.center)
        .lineLimit(lines)
        .minimumScaleFactor(0.6)
        .frame(maxWidth: .infinity)
        .environment(\.layoutDirection, .rightToLeft)
    }
}

struct AyahLockScreenView: View {
    let state: SakinaAyahAttributes.ContentState
    var body: some View {
        VStack(spacing: 8) {
            AyahText(state: state, size: 20, lines: 4)
            HStack(spacing: 6) {
                Image(systemName: state.playing ? "waveform" : "pause.fill").font(.caption).foregroundStyle(sakinaGold)
                Text(state.reciter.isEmpty ? "سورة \(state.surah)" : "سورة \(state.surah) · \(state.reciter)")
                    .font(.footnote).foregroundStyle(.white.opacity(0.8)).lineLimit(1)
                Spacer(minLength: 0)
                if state.ayahNo > 0 { Text("آية \(state.ayahNo)").font(.footnote.monospacedDigit()).foregroundStyle(.white.opacity(0.7)) }
            }
            .environment(\.layoutDirection, .rightToLeft)
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
        .foregroundStyle(.white)
    }
}
