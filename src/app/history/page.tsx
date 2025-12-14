// src/app/history/page.tsx

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, BarChart, Clock, CarTaxiFront, DollarSign, RefreshCw } from 'lucide-react';
// Supabaseクライアントのインポート
import { getSupabaseClient } from '../../../utils/supabase';

// データ型定義 (Home/page.tsxから再利用)
interface Shift {
    id: string;
    start_time: string;
    end_time: string; // 履歴画面では終了済みなのでnullではない
    target_amount: number;
    // 総売上を格納するためのフィールドを追加
    total_sales: number; 
}

export default function HistoryPage() {
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Supabaseクライアントを取得
    const supabase = getSupabaseClient();
    
    const fetchHistory = useCallback(async () => {
        setIsLoading(true);

        if (!supabase) {
            console.error("Supabase client is not available.");
            setIsLoading(false);
            return;
        }

        // 終了した全てのシフトを取得し、開始時間の新しい順に並べる
        const { data: shiftsData, error: shiftsError } = await supabase
            .from('shifts')
            .select(`
                id, 
                start_time, 
                end_time, 
                target_amount, 
                sales ( amount )
            `)
            .not('end_time', 'is', null) // end_time が NULL ではないもの (終了済みのもの) のみ
            .order('start_time', { ascending: false });

        if (shiftsError) {
            console.error("履歴データ取得エラー:", shiftsError.message);
            setIsLoading(false);
            return;
        }

        // 取得したシフトデータと売上データを整形
        const processedShifts: Shift[] = shiftsData.map((shift: any) => {
            // そのシフトの全ての売上を合計
            const totalSales = shift.sales.reduce((sum: number, sale: { amount: number }) => sum + sale.amount, 0);
            
            return {
                id: shift.id,
                start_time: shift.start_time,
                end_time: shift.end_time,
                target_amount: shift.target_amount,
                total_sales: totalSales, // 計算した総売上を格納
            };
        });

        setShifts(processedShifts);
        setIsLoading(false);
    }, [supabase]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);
    
    // ロード中画面
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black text-white">
                <p className="text-xl font-bold">履歴をロード中...</p>
            </div>
        );
    }

    // UIレンダリング
    return (
        <div className="min-h-screen bg-black p-0 max-w-md mx-auto text-white">
            <header className="flex justify-between items-center p-4 pt-6 pb-4 border-b border-gray-800">
                <Link href="/" className="flex items-center text-yellow-500 hover:text-yellow-400">
                    <ChevronLeft size={24} className="mr-1" />
                    ホームへ
                </Link>
                <h1 className="text-2xl font-bold">シフト履歴</h1>
                <button 
                    onClick={fetchHistory}
                    className="p-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                    title="履歴を更新"
                >
                    <RefreshCw size={20} />
                </button>
            </header>
            
            <main className="mt-4 p-4">
                {shifts.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <CarTaxiFront size={48} className="mx-auto mb-3" />
                        <p className="text-lg">過去の終了したシフトはありません。</p>
                        <p className="text-sm">メイン画面からシフトを開始・終了してください。</p>
                        <Link href="/analysis" className="mt-4 block text-sm text-blue-400 hover:text-blue-300">
                            統計画面へ
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {shifts.map(shift => {
                            const startTime = new Date(shift.start_time);
                            const endTime = new Date(shift.end_time);
                            
                            // 稼働時間計算 (ミリ秒)
                            const durationMs = endTime.getTime() - startTime.getTime();
                            const hours = Math.floor(durationMs / (1000 * 60 * 60));
                            const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                            
                            // 目標達成率
                            const achievement = shift.target_amount > 0 
                                ? Math.round((shift.total_sales / shift.target_amount) * 100)
                                : 0;
                            
                            return (
                                <div 
                                    key={shift.id} 
                                    className="bg-gray-800 p-4 rounded-xl shadow-lg border-l-4 border-yellow-500 hover:bg-gray-700 transition"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-sm text-gray-300 flex items-center">
                                            <Clock size={16} className="mr-1 text-gray-400" />
                                            {startTime.toLocaleDateString('ja-JP')}
                                        </p>
                                        <p className={`text-sm font-bold ${achievement >= 100 ? 'text-green-400' : 'text-red-400'}`}>
                                            達成率: {achievement}%
                                        </p>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <p className="text-3xl font-extrabold text-white flex items-center">
                                            <DollarSign size={24} className="mr-2 text-green-400" />
                                            ¥{shift.total_sales.toLocaleString()}
                                        </p>
                                    </div>
                                    
                                    <div className="mt-2 text-xs text-gray-400 space-y-1">
                                        <p>目標: ¥{shift.target_amount.toLocaleString()}</p>
                                        <p>時間: {hours}時間 {minutes}分 ({startTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}〜{endTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })})</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}