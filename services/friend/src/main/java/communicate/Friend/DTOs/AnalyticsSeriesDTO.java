package communicate.Friend.DTOs;

import java.util.List;

// Day-by-day EMA walk for a friend over [left, right], server-computed via
// EmaMathService — same shape react/src/utils/analyticsMath.ts used to
// produce client-side (labels/duration/frequency/intensity), plus proximity.
public record AnalyticsSeriesDTO(List<String> labels, List<Double> duration, List<Double> frequency,
                                  List<Double> intensity, List<Double> proximity) {
}
