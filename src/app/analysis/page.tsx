// src/app/analysis/page.tsx
"use client";

export const dynamic = "force-dynamic";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { supabase } from "../../../utils/supabase";
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

// ★★★ データ型定義 ★★★
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
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);

    // ✅ TypeScriptが理解できるnullガード
    const client = supabase;

    if (!client) {
      console.error("Supabase is not initialized");
      setIsLoading(false);
      return;
    }

    const { data: shiftData, error: shiftError } = await client
      .from("shifts")
      .select("*, sales(*)")
      .not("end_time", "is", null)
      .order("start_time", { ascending: false });

    if (shiftError) {
      console.error("シフトデータ取得エラー:", shiftError.message);
      setShifts([]);
    } else {
      setShifts((shiftData ?? []) as Shift[]);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ★★★ 集計ロジック ★★★
  const dailySummaries = useMemo(() => {
    const summariesMap: Record<string, DailySummary> = {};

    for (const shift of shifts) {
      const startDate = new Date(shift.start_time);
      const dateKey = startDate.toISOString().split("T")[0];

      const totalSales = shift.sales.reduce(
        (sum, sale) => sum + sale.amount,
        0
      );
      const rideCount = shift.sales.length;

      if (!summariesMap[dateKey]) {
        summariesMap[dateKey] = {
          date: dateKey,
          dayOfWeek: dayOfWeekMap[startDate.getDay()],
          startTime: null,
          endTime: null,
          rideCount: 0,
          totalSales: 0,
          shiftCount: 0,
        };
      }

      const current = summariesMap[dateKey];
      current.rideCount += rideCount;
      current.totalSales += totalSales;
      current.shiftCount += 1;

      if (
        shift.start_time &&
        (!current.startTime || shift.start_time < current.startTime)
      ) {
        current.startTime = shift.start_time;
      }

      if (
        shift.end_time &&
        (!current.endTime || shift.end_time > current.endTime)
      ) {
        current.endTime = shift.end_time;
      }
    }

    return Object.values(summariesMap).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }, [shifts]);

  const formatTime = (isoString: string | null): string => {
    if (!isoString) return "—";
    const date = new Date(isoString);
    return date.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p className="text-xl font-bold">データをロード中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 max-w-md mx-auto">
      {/* UI部分は既存のままでOK */}
    </div>
  );
}
