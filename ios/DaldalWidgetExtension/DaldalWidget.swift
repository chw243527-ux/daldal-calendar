import SwiftUI
import WidgetKit

struct DaldalEntry: TimelineEntry {
    let date: Date
    let todoCount: Int
    let eventCount: Int
    let balance: Int
}

struct DaldalProvider: TimelineProvider {
    func placeholder(in context: Context) -> DaldalEntry {
        DaldalEntry(date: Date(), todoCount: 2, eventCount: 1, balance: 2501000)
    }

    func getSnapshot(in context: Context, completion: @escaping (DaldalEntry) -> Void) {
        completion(DaldalEntry(date: Date(), todoCount: 2, eventCount: 1, balance: 2501000))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DaldalEntry>) -> Void) {
        let entry = DaldalEntry(date: Date(), todoCount: 0, eventCount: 0, balance: 0)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

struct DaldalWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DaldalEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            VStack(spacing: 1) {
                Text("할 일").font(.caption2)
                Text("\(entry.todoCount)").font(.headline.bold())
            }
        case .accessoryInline:
            Text("달달 · 할 일 \(entry.todoCount)개 · 일정 \(entry.eventCount)개")
        default:
            VStack(alignment: .leading, spacing: 4) {
                Text("달달 캘린더").font(.headline.bold())
                Text("할 일 \(entry.todoCount)개 · 일정 \(entry.eventCount)개").font(.caption)
                Text("잔액 \(entry.balance)원").font(.subheadline.bold())
            }
            .containerBackground(.fill.tertiary, for: .widget)
        }
    }
}

struct DaldalWidget: Widget {
    let kind = "DaldalWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DaldalProvider()) { entry in
            DaldalWidgetView(entry: entry)
        }
        .configurationDisplayName("달달 캘린더")
        .description("오늘 할 일과 일정을 잠금화면에서 확인해요.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

@main
struct DaldalWidgetBundle: WidgetBundle {
    var body: some Widget {
        DaldalWidget()
    }
}
