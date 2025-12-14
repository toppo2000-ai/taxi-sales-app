"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { getSupabaseClient } from "../../../utils/supabase";
import {
  BarChart,
  ArrowLeft,
  DollarSign,
  ListChecks,
  Calendar,
  Sunrise,
  Sunset,
  FileText,
} from "lucide-react";
import Link from "next/link";

interface Shift {
  id: string;
  start_time: string;
  end_time: string | null;
  target_amount: number;
  sales: Sale[];
}

interface Sale {
  id: string;
  amount: number;
  payment_method_id: number;
  created_at: string;
  shift_id: string;
}

interface DailySummary {
  date: string;
  dayOfWeek: string;
  startTime: string | null;
  endTime: string | null;
  rideCount: number;
  totalSales: number;
  shiftCount: number;
}

const dayOfWeekMap = ["日", "月", "火", "水", "木", "金", "土"];

export default function AnalysisPage() {
  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseClient>>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Supabase を client 側でのみ取得
  useEffect(() => {
    setSupabase(getSupabaseClient());
  }, []);

  const fetchData = useCallback(async () => {
    if (!supabase) return;

    setIsLoading(true);

    const { data, error } = await supabase
      .from("shifts")
      .select("*, sales(*)")
      .not("end_time", "is", null)
      .order("start_time", { ascending: false });

    if (error) {
      console.error(error.message);
      setShifts([]);
    } else {
      setShifts(data as Shift[]);
    }

    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (supabase) fetchData();
  }, [supabase, fetchData]);

  const dailySummaries = useMemo(() => {
    const map: Record<string, DailySummary> = {};

    for (const shift of shifts) {
      const d = new Date(shift.start_time);
      const key = d.toISOString().split("T")[0];

      if (!map[key]) {
        map[key] = {
          date: key,
          dayOfWeek: dayOfWeekMap[d.getDay()],
          startTime: null,
          endTime: null,
          rideCount: 0,
          totalSales: 0,
          shiftCount: 0,
        };
      }

      map[key].rideCount += shift.sales.length;
      map[key].totalSales += shift.sales.reduce((s, v) => s + v.amount, 0);
      map[key].shiftCount += 1;

      map[key].startTime = map[key].startTime
        ? Math.min(map[key].startTime as any, shift.start_time as any)
        : shift.start_time;

      map[key].endTime = map[key].endTime
        ? Math.max(map[key].endTime as any, shift.end_time as any)
        : shift.end_time;
    }

    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  }, [shifts]);

  if (isLoading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 max-w-md mx-auto">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <BarChart className="mr-2 text-yellow-500" /> 売上分析
        </h1>
        <Link href="/" className="text-sm text-gray-400 flex items-center">
          <ArrowLeft className="mr-1" /> 戻る
        </Link>
      </header>

      {dailySummaries.map((d) => (
        <div key={d.date} className="mb-4 p-4 bg-gray-800 rounded-xl">
          <div className="font-bold mb-2">
            {d.date} ({d.dayOfWeek})
          </div>
          <div className="text-yellow-400 text-2xl font-extrabold">
            ¥{d.totalSales.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">
            件数 {d.rideCount} / {d.shiftCount}シフト
          </div>
        </div>
      ))}
    </div>
  );
}
