// src/app/analysis/page.tsx

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
  
  // 【修正 1/4】: 型を number | null に変更
  startTime: number | null; 
  
  // 【修正 2/4】: 型を number | null に変更
  endTime: number | null; 
  
  rideCount: number;
  totalSales: number;
  shiftCount: number;
}

const dayOfWeekMap = ["日", "月", "火", "水", "木", "金", "土"];

// ヘルパー関数: 数値タイムスタンプを hh:mm 形式に変換
const formatTime = (timestamp: number | null): string => {
    if (timestamp === null) return "N/A";
    return new Date(timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
};


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

      // shift.start_time (ISO文字列) を数値のタイムスタンプに変換
      const shiftStartTimeStamp = new Date(shift.start_time).getTime();
      
      // 【修正 3/4】: Math.min の比較と代入を数値タイムスタンプで行う
      map[key].startTime = map[key].startTime
        ? Math.min(map[key].startTime, shiftStartTimeStamp)
        : shiftStartTimeStamp;

      // shift.end_time (ISO文字列) を数値のタイムスタンプに変換 (nullチェックが必要)
      const shiftEndTimeStamp = shift.end_time ? new Date(shift.end_time).getTime() : null;

      // 【修正 4/4】: Math.max の比較と代入を数値タイムスタンプで行う
      // shift.end_time が null でない場合のみ更新
      if (shiftEndTimeStamp !== null) {
          map[key].endTime = map[key].endTime
            ? Math.max(map[key].endTime, shiftEndTimeStamp)
            : shiftEndTimeStamp;
      }
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
        <Link href="/" className="text-sm text-gray-400 flex items-center hover:text-yellow-500 transition">
          <ArrowLeft className="mr-1" size={16} /> 戻る
        </Link>
      </header>
      
      <h2 className="text-xl font-bold mb-4 text-gray-300 flex items-center">
        <ListChecks size={20} className="mr-2 text-yellow-500"/>
        日別集計一覧 ({dailySummaries.length}日分)
      </h2>
      
      {dailySummaries.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
            <FileText size={48} className="mx-auto mb-3" />
            <p className="text-lg">集計する終了シフトがありません。</p>
            <p className="text-sm">メイン画面からシフトを開始・終了してください。</p>
        </div>
      ) : (
        <div className="space-y-4">
            {dailySummaries.map((d) => (
                <div key={d.date} className="p-4 bg-gray-800 rounded-xl border-l-4 border-yellow-500 shadow-lg">
                    <div className="flex justify-between items-center mb-2">
                        <div className="font-bold text-lg text-white">
                            <Calendar size={16} className="inline mr-1 text-gray-400"/>
                            {d.date} ({d.dayOfWeek})
                        </div>
                        <div className="text-yellow-400 text-2xl font-extrabold flex items-center">
                            <DollarSign size={20} className="mr-1 text-green-400" />
                            ¥{d.totalSales.toLocaleString()}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-400 border-t border-gray-700 pt-2">
                        <p>
                            <ListChecks size={14} className="inline mr-1 text-blue-400" />
                            乗車回数: <span className="text-white font-semibold">{d.rideCount}</span>
                        </p>
                        <p>
                            <FileText size={14} className="inline mr-1 text-orange-400" />
                            シフト数: <span className="text-white font-semibold">{d.shiftCount}</span>
                        </p>
                        <p className="col-span-2">
                            <Sunrise size={14} className="inline mr-1 text-red-400" />
                            稼働時間: <span className="text-white font-semibold">
                                {formatTime(d.startTime)}
                                〜
                                {formatTime(d.endTime)}
                            </span>
                        </p>
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );
}