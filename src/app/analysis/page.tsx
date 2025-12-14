// src/app/analysis/page.tsx

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../utils/supabase'; 
import { BarChart, ArrowLeft, Clock, DollarSign, ListChecks, Calendar, Sunrise, Sunset, FileText } from 'lucide-react';
import Link from 'next/link';

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

// 日付ごとの集計結果の型
interface DailySummary {
    date: string; // YYYY-MM-DD
    dayOfWeek: string;
    startTime: string | null;
    endTime: string | null;
    rideCount: number;
    totalSales: number;
    shiftCount: number;
}

// 曜日マッピング
const dayOfWeekMap = ['日', '月', '火', '水', '木', '金', '土'];

// ★★★ メインコンポーネント ★★★
export default function AnalysisPage() {
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        
        const { data: shiftData, error: shiftError } = await supabase
            .from('shifts')
            .select('*, sales(*)') 
            .not('end_time', 'is', null) 
            .order('start_time', { ascending: false }); 

        if (shiftError) {
            console.error("シフトデータ取得エラー:", shiftError.message);
            setShifts([]);
        } else {
            setShifts(shiftData as Shift[]);
        }

        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ★★★ 日付ごとの集計ロジック (変更なし) ★★★
    const dailySummaries = useMemo(() => {
        const summariesMap: { [date: string]: DailySummary } = {};

        for (const shift of shifts) {
            const startDate = new Date(shift.start_time);
            const dateKey = startDate.toISOString().split('T')[0];

            const totalSales = shift.sales.reduce((sum, sale) => sum + sale.amount, 0);
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

            const currentSummary = summariesMap[dateKey];
            
            currentSummary.rideCount += rideCount;
            currentSummary.totalSales += totalSales;
            currentSummary.shiftCount += 1;
            
            if (shift.start_time && (!currentSummary.startTime || shift.start_time < currentSummary.startTime)) {
                currentSummary.startTime = shift.start_time;
            }
            if (shift.end_time && (!currentSummary.endTime || shift.end_time > currentSummary.endTime)) {
                currentSummary.endTime = shift.end_time;
            }
        }

        return Object.values(summariesMap).sort((a, b) => b.date.localeCompare(a.date));

    }, [shifts]);


    // 時刻のフォーマット関数 (例: 17:30)
    const formatTime = (isoString: string | null): string => {
        if (!isoString) return '—';
        const date = new Date(isoString);
        // 時刻が翌日の場合（24時超え）は、計算ロジックが必要だが、ここでは簡略化
        return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    // ローディング画面
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black text-white">
                <p className="text-xl font-bold">データをロード中...</p>
            </div>
        );
    }
    
    // UIレンダリング
    return (
        <div className="min-h-screen bg-black text-white p-4 max-w-md mx-auto">
            
            {/* ヘッダー */}
            <header className="flex justify-between items-center mb-8 pt-6">
                <h1 className="text-3xl font-bold flex items-center">
                    <BarChart size={28} className="mr-2 text-yellow-500" />
                    売上分析・実績
                </h1>
                <Link href="/" className="flex items-center text-sm text-gray-400 hover:text-yellow-500">
                    <ArrowLeft size={20} className="mr-1" />
                    ホームへ戻る
                </Link>
            </header>

            {/* ★★★ 月次サマリー (簡略版) ★★★ */}
            <section className="mb-8 p-4 bg-gray-900 rounded-xl shadow-lg">
                <h2 className="text-xl font-bold mb-4 flex items-center">
                    <ListChecks size={20} className="mr-2 text-red-400" />
                    月次サマリー ({dailySummaries.length}日間の実績)
                </h2>
                <div className="flex justify-around text-center">
                    <div>
                        <p className="text-sm text-gray-400">総売上</p>
                        <p className="text-2xl font-extrabold text-green-400">
                            ¥{dailySummaries.reduce((sum, d) => sum + d.totalSales, 0).toLocaleString()}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-400">平均日収</p>
                        <p className="text-2xl font-extrabold text-blue-400">
                            ¥{dailySummaries.length > 0 ? Math.round(dailySummaries.reduce((sum, d) => sum + d.totalSales, 0) / dailySummaries.length).toLocaleString() : 0}
                        </p>
                    </div>
                </div>
            </section>

            {/* ★★★ 日次実績カードリスト (スマホ最適化) ★★★ */}
            <section>
                <h2 className="text-xl font-bold mb-4 flex items-center text-gray-300">
                    <Calendar size={20} className="mr-2 text-yellow-500" />
                    日次実績一覧
                </h2>
                
                <div className="space-y-4">
                    {dailySummaries.length === 0 ? (
                        <p className="text-gray-500 text-center p-4">終了したシフトがありません。</p>
                    ) : (
                        dailySummaries.map((summary) => {
                            const isWeekend = summary.dayOfWeek === '日' || summary.dayOfWeek === '土';
                            const dateString = summary.date.slice(5).replace('-', '/');
                            
                            return (
                                <div 
                                    key={summary.date} 
                                    className={`p-4 rounded-xl shadow-lg border-l-4 ${isWeekend ? 'bg-gray-800 border-red-500' : 'bg-gray-700 border-yellow-500'}`}
                                >
                                    {/* 日付と曜日 */}
                                    <div className="flex justify-between items-center border-b border-gray-600 pb-2 mb-2">
                                        <h3 className="text-lg font-extrabold flex items-center">
                                            {dateString} (
                                            <span className={`${summary.dayOfWeek === '日' ? 'text-red-400' : 'text-blue-300'}`}>
                                                {summary.dayOfWeek}
                                            </span>
                                            )
                                        </h3>
                                        <span className="text-sm text-gray-400">{summary.shiftCount}シフト</span>
                                    </div>

                                    {/* 売上合計 */}
                                    <div className="flex justify-between items-center my-2">
                                        <div className="flex items-center text-gray-300 font-semibold">
                                            <DollarSign size={20} className="text-yellow-400 mr-2" />
                                            営業収
                                        </div>
                                        <p className="text-3xl font-extrabold text-yellow-400">
                                            ¥{summary.totalSales.toLocaleString()}
                                        </p>
                                    </div>
                                    
                                    {/* 詳細情報グリッド */}
                                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 pt-2 border-t border-gray-600 text-sm text-gray-300">
                                        
                                        {/* 件数 */}
                                        <div className="flex items-center">
                                            <FileText size={16} className="text-gray-500 mr-2" />
                                            件数: <span className="font-semibold ml-1">{summary.rideCount}</span>
                                        </div>
                                        
                                        {/* 平均単価 (計算) */}
                                        <div className="flex items-center">
                                            <DollarSign size={16} className="text-gray-500 mr-2" />
                                            平均: <span className="font-semibold ml-1">
                                                ¥{summary.rideCount > 0 ? Math.round(summary.totalSales / summary.rideCount).toLocaleString() : 0}
                                            </span>
                                        </div>

                                        {/* 出庫時間 */}
                                        <div className="flex items-center">
                                            <Sunrise size={16} className="text-gray-500 mr-2" />
                                            出庫: <span className="font-semibold ml-1">{formatTime(summary.startTime)}</span>
                                        </div>

                                        {/* 入庫時間 */}
                                        <div className="flex items-center">
                                            <Sunset size={16} className="text-gray-500 mr-2" />
                                            入庫: <span className="font-semibold ml-1">{formatTime(summary.endTime)}</span>
                                        </div>

                                    </div>

                                </div>
                            );
                        })
                    )}
                </div>
            </section>
        </div>
    );
}