"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";

export type BarDatum = { label: string; value: number; color?: string };

/**
 * Accessible bar chart: the chart itself is decorative (aria-hidden); the same numbers are always
 * available as a real table, bars carry value labels, and colours never carry meaning alone.
 */
export function BarChartCard({
  title,
  caption,
  data,
  horizontal = false,
  valueLabel = "Count",
  emptyText = "No data for this period.",
}: {
  title: string;
  caption?: string;
  data: BarDatum[];
  horizontal?: boolean;
  valueLabel?: string;
  emptyText?: string;
}) {
  const total = data.reduce((n, d) => n + d.value, 0);
  const height = horizontal ? Math.max(160, data.length * 36 + 40) : 220;
  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {caption ? <p className="text-xs text-muted">{caption}</p> : null}
      </div>
      {total === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{emptyText}</p>
      ) : (
        <div aria-hidden="true" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 16, right: 16, bottom: 4, left: horizontal ? 24 : 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dfe4e1" vertical={!horizontal} horizontal={horizontal ? false : true} />
              {horizontal ? (
                <>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12 }} />
                </>
              ) : (
                <>
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
                </>
              )}
              <Bar dataKey="value" radius={3} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell key={d.label} fill={d.color ?? "#167c50"} />
                ))}
                <LabelList dataKey="value" position={horizontal ? "right" : "top"} style={{ fontSize: 12, fill: "#1f2933" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-primary underline">View as table</summary>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-1">
                Category
              </th>
              <th scope="col" className="py-1 text-right">
                {valueLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-b border-border/60">
                <th scope="row" className="py-1 font-normal">
                  {d.label}
                </th>
                <td className="py-1 text-right">{d.value}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="py-1">
                Total
              </th>
              <td className="py-1 text-right font-semibold">{total}</td>
            </tr>
          </tfoot>
        </table>
      </details>
    </section>
  );
}
