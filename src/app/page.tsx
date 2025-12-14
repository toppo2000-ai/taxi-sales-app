// src/app/page.tsx

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
// 【修正1】supabaseを直接インポートするのではなく、getSupabaseClient関数をインポート
import { getSupabaseClient } from '../../utils/supabase';
import { DollarSign, Clock, Target, Plus, RefreshCw, BarChart, Smartphone, CreditCard, Tag, CarTaxiFront, TrendingUp, Calendar } from 'lucide-react'; 
import Link from 'next/link';

// ★★★ KeypadModal のインポート ★★★
import { KeypadModal } from '../components/KeypadModal';

// ★★★ 定数とLocalStorageキー ★★★
const LOCAL_STORAGE_CLOSING_DAY_KEY = 'taxi_closing_day';
const LOCAL_STORAGE_MONTHLY_TARGET_KEY = 'taxi_monthly_target';

// ★★★ データ型定義 ★★★
interface Shift {
    id: string;
    start_time: string;
    end_time: string | null;
    target_amount: number;
}

interface Sale {
    id: string;
    amount: number;
    payment_method_id: number;
    created_at: string;
    shift_id: string; 
}

// 支払い方法マッピング
const paymentMethods = [
    { id: 1, name: '現金', key: 'cash' },
    { id: 2, name: 'アプリ/QR', key: 'qr/other' },
    { id: 3, name: 'カード', key: 'card' },
    { id: 4, name: 'チケ', key: 'ticket' },
];

const paymentMethodMap: { [key: string]: number } = {
    'cash': 1,
    'qr/other': 2,
    'card': 3,
    'ticket': 4,
};

const paymentMethodNameMap: { [key: number]: string } = {
    1: '現金', 2: 'アプリ/QR', 3: 'カード', 4: 'チケ'
};

const paymentMethodIconMap: { [key: number]: React.ElementType } = {
    1: DollarSign,
    2: Smartphone,
    3: CreditCard,
    4: Tag,
};

const paymentMethodColorMap: { [key: number]: string } = {
    1: 'text-green-500', 2: 'text-blue-500', 3: 'text-red-500', 4: 'text-yellow-500'
};

// ★★★ ヘルパー関数: 月間期間の計算 ★★★
const formatToSupabaseDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00+00:00`; 
};

const calculateMonthlyPeriod = (closingDay: number): { start: string, end: string, periodText: string } => {
    if (!closingDay) {
        return { start: new Date(0).toISOString(), end: new Date().toISOString(), periodText: '期間未設定' };
    }
    
    const now = new Date();
    const today = now.getDate();
    let startDate: Date;
    
    if (today > closingDay) {
        startDate = new Date(now.getFullYear(), now.getMonth(), closingDay + 1);
    } else {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, closingDay + 1);
    }
    
    const startMonth = startDate.getMonth() + 1;
    const startDay = startDate.getDate();
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, closingDay);
    const endMonth = endDate.getMonth() + 1;
    const endDay = endDate.getDate();

    const periodText = `${startMonth}/${startDay} 〜 ${endMonth}/${endDay}`;
    
    return { 
        start: formatToSupabaseDate(startDate), 
        end: now.toISOString(),
        periodText: periodText,
    };
};


// ★★★ メインコンポーネント ★★★
export default function Home() {
    const [currentShift, setCurrentShift] = useState<Shift | null>(null);
    const [sales, setSales] = useState<Sale[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [targetInput, setTargetInput] = useState<string>('30000');

    // キーパッド・モーダル関連のステート
    const [keypadAmount, setKeypadAmount] = useState<number | ''>('');
    const [keypadPaymentMethod, setKeypadPaymentMethod] = useState<string>('cash');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [editingSaleId, setEditingSaleId] = useState<string | null>(null); 

    // 月間目標関連のステート
    const [monthlyClosingDay, setMonthlyClosingDay] = useState<number | null>(null);
    const [monthlyTarget, setMonthlyTarget] = useState<number>(0);
    const [monthlySummary, setMonthlySummary] = useState<{ totalSales: number, rideCount: number, periodText: string }>({ totalSales: 0, rideCount: 0, periodText: '' });
    const [isMonthlySettingsModalOpen, setIsMonthlySettingsModalOpen] = useState(false);

    // 【修正2】getSupabaseClient() を呼び出してクライアントインスタンスを取得
    const supabase = getSupabaseClient();

    // 設定の読み込み
    useEffect(() => {
        const storedClosingDay = localStorage.getItem(LOCAL_STORAGE_CLOSING_DAY_KEY);
        const day = storedClosingDay ? parseInt(storedClosingDay) : 25;
        setMonthlyClosingDay(day); 
        
        const storedTarget = localStorage.getItem(LOCAL_STORAGE_MONTHLY_TARGET_KEY);
        const target = storedTarget ? parseInt(storedTarget) : 600000;
        setMonthlyTarget(target); 
    }, []);

    // 集計計算 (シフトごと)
    const shiftSummary = useMemo(() => {
        const totalSales = sales.reduce((sum, sale) => sum + sale.amount, 0);
        const rideCount = sales.length;
        const avgFare = rideCount > 0 ? Math.round(totalSales / rideCount) : 0;
        
        const breakdown = Object.entries(paymentMethodMap).map(([key, id]) => {
            const amount = sales
                .filter(sale => sale.payment_method_id === id)
                .reduce((sum, sale) => sum + sale.amount, 0);
            return { 
                id: id, 
                name: paymentMethodNameMap[id], 
                amount: amount, 
                icon: paymentMethodIconMap[id], 
                color: paymentMethodColorMap[id],
                key: key,
            };
        });

        const filteredBreakdown = breakdown.filter(b => b.amount > 0);
        
        return { totalSales, rideCount, avgFare, breakdown: filteredBreakdown };
    }, [sales]);


    // ★★★ 修正ポイント: fetchData を最初に定義する (依存関係の解消) ★★★
    const fetchData = useCallback(async (closingDay: number | null = monthlyClosingDay) => {
        setIsLoading(true);

        // 【修正3】supabaseのnullチェック
        if (!supabase) {
            console.error("Supabase client is not available (Missing ENV or during SSR).");
            setIsLoading(false);
            return;
        }

        // 1. アクティブなシフトのデータを取得
        const { data: shiftData, error: shiftError } = await supabase
            .from('shifts')
            .select('*')
            .is('end_time', null)
            .limit(1);

        if (shiftError) {
            console.error("シフトデータ取得エラー:", shiftError.message);
        }

        const activeShift = shiftData && shiftData.length > 0 ? shiftData[0] as Shift : null;
        setCurrentShift(activeShift);
        
        if (activeShift) {
            const { data: salesData, error: salesError } = await supabase
                .from('sales')
                .select('*')
                .eq('shift_id', activeShift.id) 
                .order('created_at', { ascending: false });

            if (salesError) {
                console.error("売上データ取得エラー:", salesError.message);
                setSales([]);
            } else {
                setSales(salesData as Sale[]);
            }
        } else {
            setSales([]);
        }


        // 2. 月間集計
        if (closingDay) {
            const { start: periodStart, end: periodEnd, periodText } = calculateMonthlyPeriod(closingDay);
            
            const { data: periodShiftsData, error: periodShiftsError } = await supabase
                .from('shifts')
                .select('id')
                .gte('start_time', periodStart)
                .lt('start_time', periodEnd); 

            let monthlyTotalSales = 0;
            let monthlyRideCount = 0;

            if (periodShiftsError) {
                console.error("期間内シフトデータ取得エラー:", periodShiftsError.message);
            } else if (periodShiftsData.length > 0) {
                const shiftIds = periodShiftsData.map(s => s.id);

                const { data: monthlySalesData, error: monthlySalesError } = await supabase
                    .from('sales')
                    .select('amount')
                    .in('shift_id', shiftIds);

                if (monthlySalesError) {
                    console.error("月間売上データ取得エラー:", monthlySalesError.message);
                } else {
                    monthlyTotalSales = monthlySalesData.reduce((sum, sale) => sum + sale.amount, 0);
                    monthlyRideCount = monthlySalesData.length;
                }
            }

            setMonthlySummary({ 
                totalSales: monthlyTotalSales, 
                rideCount: monthlyRideCount, 
                periodText: periodText 
            });
        }

        setIsLoading(false);
    }, [monthlyClosingDay, supabase]); // 依存関係にsupabaseを追加

    // monthlyClosingDay が設定されたらデータを取得
    useEffect(() => {
        if (monthlyClosingDay !== null) {
            fetchData();
        }
    }, [fetchData, monthlyClosingDay]);


    // シフト開始ロジック
    const startShift = useCallback(async () => {
        if (currentShift) return;

        // 【修正4】supabaseのnullチェック (startShift)
        if (!supabase) {
            alert('シフト開始に失敗しました。: データベース接続エラー');
            return;
        }

        const target = parseInt(targetInput) || 30000;
        
        const { data, error } = await supabase
            .from('shifts')
            .insert({ target_amount: target })
            .select()
            .single();

        if (error) {
            console.error('シフト開始エラー:', error.message);
            alert('シフト開始に失敗しました。');
        } else if (data) {
            setCurrentShift(data as Shift);
            setSales([]);
        }
    }, [currentShift, targetInput, supabase]); // 依存関係にsupabaseを追加

    // シフト終了ロジック
    const endShift = useCallback(async () => {
        if (!currentShift) return;

        // 【修正5】supabaseのnullチェック (endShift)
        if (!supabase) {
            alert('シフト終了に失敗しました。: データベース接続エラー');
            return;
        }

        const confirmEnd = window.confirm(`総売上 ¥${shiftSummary.totalSales.toLocaleString()} でシフトを終了しますか？`);
        if (!confirmEnd) return;
        
        const { error } = await supabase
            .from('shifts')
            .update({ end_time: new Date().toISOString() })
            .eq('id', currentShift.id);

        if (error) {
            console.error('シフト終了エラー:', error.message);
            alert('シフト終了に失敗しました。');
        } else {
            setCurrentShift(null);
            setSales([]);
            // fetchDataを呼び出し可能
            if (monthlyClosingDay) fetchData(monthlyClosingDay);
        }
    }, [currentShift, shiftSummary.totalSales, monthlyClosingDay, fetchData, supabase]); // 依存関係にsupabaseを追加


    // 目標達成率の計算 (シフトごと)
    const achievementPercentage = useMemo(() => {
        if (!currentShift || currentShift.target_amount === 0) return 0;
        return Math.min(100, Math.round((shiftSummary.totalSales / currentShift.target_amount) * 100));
    }, [currentShift, shiftSummary.totalSales]);

    // 月間達成率の計算
    const monthlyAchievementPercentage = useMemo(() => {
        if (monthlyTarget === 0) return 0;
        return Math.min(100, Math.round((monthlySummary.totalSales / monthlyTarget) * 100));
    }, [monthlySummary.totalSales, monthlyTarget]);


    // キーパッドロジックの実装 (handleKeypadPress)
    const handleKeypadPress = useCallback((value: string | 'C' | 'DEL') => {
        if (isRegistering) return;
        
        let current = keypadAmount === '' ? '0' : String(keypadAmount);

        if (value === 'C') {
            setKeypadAmount('');
            return;
        }
        if (value === 'DEL') {
            setKeypadAmount(current.length > 1 ? Number(current.slice(0, -1)) : '');
            return;
        }

        if (current.length >= 7) return; 

        if (current === '0' && value !== '0') {
            current = '';
        }

        const newValue = parseInt(current + value);
        
        if (newValue > 9999999) return; 
        
        setKeypadAmount(newValue);

    }, [keypadAmount, isRegistering]);


    // 売上登録/更新ロジック (handleRegisterSale)
    const handleRegisterSale = useCallback(async () => {
        if (!currentShift || keypadAmount === '' || keypadAmount === 0 || isRegistering) return;
        
        // 【修正6】supabaseのnullチェック (handleRegisterSale)
        if (!supabase) {
            alert('売上処理エラー: データベース接続エラー');
            return;
        }

        setIsRegistering(true);
        const amount = Number(keypadAmount);
        const methodId = paymentMethodMap[keypadPaymentMethod];

        if (!methodId) {
            alert('支払い方法が選択されていません。');
            setIsRegistering(false);
            return;
        }

        let error: { message: string } | null = null;
        
        if (editingSaleId) {
            const { error: updateError } = await supabase
                .from('sales')
                .update({ 
                    amount: amount, 
                    payment_method_id: methodId,
                })
                .eq('id', editingSaleId);
            error = updateError;

        } else {
            const { error: insertError } = await supabase
                .from('sales')
                .insert({ 
                    amount: amount, 
                    payment_method_id: methodId,
                    shift_id: currentShift.id 
                });
            error = insertError;
        }

        setIsRegistering(false);

        if (error) {
            console.error('売上処理エラー:', error.message);
            alert(`売上処理エラー: ${error.message}`);
        } else {
            setIsModalOpen(false);
            setEditingSaleId(null); 
            setKeypadAmount('');
            fetchData(); // データリフレッシュ
        }
    }, [currentShift, keypadAmount, keypadPaymentMethod, editingSaleId, isRegistering, fetchData, supabase]); // 依存関係にsupabaseを追加


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
        <div className="min-h-screen bg-black p-0 max-w-md mx-auto">
            
            {/* 画面上部のヘッダー */}
            <header className="flex justify-between items-center px-4 pt-6 pb-2 text-white">
                <h1 className="text-xl font-bold flex items-center">
                    <CarTaxiFront size={24} className="mr-2 text-yellow-500" />
                    TaxiApp
                </h1>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => setIsMonthlySettingsModalOpen(true)}
                        className="p-1 bg-gray-700 hover:bg-gray-600 text-yellow-500 rounded-lg transition flex items-center text-sm"
                        title="月間目標設定"
                    >
                        <Target size={20} className="mr-1" /> 目標
                    </button>
                    <button 
                        onClick={() => fetchData()} 
                        className="p-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                        title="データを更新"
                    >
                        <RefreshCw size={20} />
                    </button>
                    <Link href="/analysis" className="flex items-center text-sm text-yellow-500 hover:text-yellow-400">
                        分析へ
                        <BarChart size={20} className="ml-1" />
                    </Link>
                </div>
            </header>
            
            {/* ★★★ 月間サマリーセクション ★★★ */}
            <MonthlySummaryCard 
                monthlySummary={monthlySummary} 
                monthlyTarget={monthlyTarget} 
                achievementPercentage={monthlyAchievementPercentage}
            />

            {/* ★★★ シフト管理セクション ★★★ */}
            {currentShift ? (
                <section className="p-4 bg-gray-800 text-white shadow-xl">
                    
                    {/* 営業中ステータスと時刻 */}
                    <div className="flex justify-between items-center text-sm text-gray-400 font-semibold mb-2">
                        <span className="text-green-400">営業中 ({new Date(currentShift.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })}〜)</span>
                        <button 
                            onClick={endShift}
                            className="text-red-500 hover:text-red-400 text-xs font-bold p-1 rounded transition"
                        >
                            シフト終了
                        </button>
                    </div>

                    {/* メインの売上金額 */}
                    <p className="text-6xl font-extrabold mb-4">
                        ¥{shiftSummary.totalSales.toLocaleString()}
                    </p>

                    {/* プログレスバー */}
                    <div className="w-full bg-gray-600 rounded-full h-2.5 mb-2">
                        <div 
                            className="bg-yellow-500 h-2.5 rounded-full" 
                            style={{ width: `${achievementPercentage}%` }}
                        ></div>
                    </div>
                    
                    {/* 達成率と目標金額 */}
                    <div className="flex justify-between text-xs text-gray-400 mb-6">
                        <span className="font-semibold">{achievementPercentage}% 達成 (本日の目標)</span>
                        <span>目標 ¥{currentShift.target_amount.toLocaleString()}</span>
                    </div>

                    {/* 乗車回数と平均単価のカード */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        {/* 乗車回数 */}
                        <div className="p-3 bg-gray-700 rounded-lg flex flex-col items-center justify-center shadow-md">
                            <CarTaxiFront size={24} className="text-blue-400 mb-1" />
                            <p className="text-xs text-gray-300">乗車回数</p>
                            <p className="text-2xl font-bold text-white mt-1">{shiftSummary.rideCount} 回</p>
                        </div>
                        {/* 平均単価 */}
                        <div className="p-3 bg-gray-700 rounded-lg flex flex-col items-center justify-center shadow-md">
                            <TrendingUp size={24} className="text-green-400 mb-1" />
                            <p className="text-xs text-gray-300">平均単価</p>
                            <p className="text-2xl font-bold text-white mt-1">¥{shiftSummary.avgFare.toLocaleString()}</p>
                        </div>
                    </div>
                </section>
            ) : (
                // シフト開始前
                <section className="p-4 bg-gray-900 rounded-xl shadow-lg m-4">
                    <ShiftSetupCard 
                        targetInput={targetInput}
                        setTargetInput={setTargetInput}
                        startShift={startShift}
                    />
                </section>
            )}

            
            {/* ★★★ 売上内訳と登録ボタンのコンテナ ★★★ */}
            {currentShift && (
                <div className="p-4">
                    {/* 売上内訳リスト */}
                    <div className="space-y-3 mb-8">
                        {shiftSummary.breakdown.map(method => {
                            const Icon = method.icon;
                            return (
                                <div key={method.id} className="flex justify-between items-center text-white py-2 border-b border-gray-700 hover:bg-gray-900 px-2 -mx-2 rounded">
                                    <div className="flex flex-col">
                                        <p className="text-lg font-bold">¥{method.amount.toLocaleString()}</p>
                                        <div className="flex items-center text-sm text-gray-400">
                                            {Icon && <Icon size={14} className={`${method.color} mr-1`} />}
                                            {method.name}
                                        </div>
                                    </div>
                                    <span className="text-lg font-bold text-gray-300">
                                        ¥{method.amount.toLocaleString()}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* 売上登録ボタン */}
                    <button
                        onClick={() => {
                            setKeypadAmount('');
                            setKeypadPaymentMethod('cash');
                            setEditingSaleId(null); 
                            setIsModalOpen(true);
                        }}
                        className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xl shadow-2xl flex items-center justify-center transition"
                        style={{zIndex: 10}}
                    >
                        <Plus size={24} className="mr-2" />
                        売上を入力
                    </button>
                </div>
            )}
            
            {/* ★★★ 最新の売上履歴セクションの呼び出し ★★★ */}
            {currentShift && sales.length > 0 && (
                <LatestSalesHistory 
                    sales={sales} 
                    currentShift={currentShift} 
                    fetchData={fetchData} 
                    setEditingSaleId={setEditingSaleId}
                    setKeypadAmount={setKeypadAmount}
                    setKeypadPaymentMethod={setKeypadPaymentMethod}
                    setIsModalOpen={setIsModalOpen}
                />
            )}

            {/* ★★★ キーパッドモーダルのレンダリング ★★★ */}
            <KeypadModal
                amount={keypadAmount}
                paymentMethod={keypadPaymentMethod}
                setPaymentMethod={setKeypadPaymentMethod}
                handleRegisterSale={handleRegisterSale}
                handleKeypadPress={handleKeypadPress} 
                isLoading={isRegistering}
                isDisabled={!currentShift || isRegistering}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingSaleId(null); 
                    setKeypadAmount('');
                }}
                isEditing={!!editingSaleId} 
            />

            {/* ★★★ 月間目標設定モーダルのレンダリング ★★★ */}
            <MonthlySettingsModal 
                isOpen={isMonthlySettingsModalOpen}
                onClose={() => setIsMonthlySettingsModalOpen(false)}
                currentClosingDay={monthlyClosingDay || 25}
                currentTarget={monthlyTarget}
                setClosingDay={setMonthlyClosingDay}
                setMonthlyTarget={setMonthlyTarget}
                fetchData={fetchData}
            />
        </div>
    );
}


// ★★★ サブコンポーネント定義 ★★★

// シフト設定カード
const ShiftSetupCard: React.FC<{
    targetInput: string;
    setTargetInput: (value: string) => void;
    startShift: () => void;
}> = ({ targetInput, setTargetInput, startShift }) => (
    <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center text-white mb-2">
            <Clock size={20} className="mr-2" />
            シフト開始
        </h2>
        <div className="flex items-center bg-gray-800 p-3 rounded-lg">
            <Target size={20} className="text-red-400 mr-3" />
            <span className="text-gray-400 mr-2">目標金額 (¥):</span>
            <input
                type="number"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                placeholder="目標金額"
                className="flex-1 bg-transparent border-b border-gray-600 focus:border-yellow-500 outline-none text-white text-right"
            />
        </div>
        <button
            onClick={startShift}
            className="w-full p-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition"
        >
            シフト開始 (▶)
        </button>
    </div>
);


// 最新の売上履歴セクション
const LatestSalesHistory: React.FC<{ 
    sales: Sale[], 
    currentShift: Shift, 
    fetchData: (closingDay?: number) => void,
    setEditingSaleId: (id: string | null) => void;
    setKeypadAmount: (amount: number | '') => void;
    setKeypadPaymentMethod: (method: string) => void;
    setIsModalOpen: (open: boolean) => void;
}> = ({ 
    sales, 
    fetchData, 
    setEditingSaleId, 
    setKeypadAmount, 
    setKeypadPaymentMethod, 
    setIsModalOpen 
}) => {
    
    // 売上削除ロジック
    const handleDelete = async (saleId: string) => {
        // 【修正7】supabaseのnullチェック (handleDelete)
        const supabase = getSupabaseClient();
        if (!supabase) {
            alert('売上削除に失敗しました。: データベース接続エラー');
            return;
        }

        if (!window.confirm("この売上を削除してもよろしいですか？\n元に戻すことはできません。")) {
            return;
        }

        const { error } = await supabase
            .from('sales')
            .delete()
            .eq('id', saleId);

        if (error) {
            console.error('売上削除エラー:', error.message);
            alert('売上削除に失敗しました。');
        } else {
            fetchData();
        }
    };

    // 修正開始ロジック
    const handleEdit = (sale: Sale) => {
        setEditingSaleId(sale.id);
        setKeypadAmount(sale.amount);
        
        const paymentKey = paymentMethods.find(p => p.id === sale.payment_method_id)?.key || 'cash';
        setKeypadPaymentMethod(paymentKey);
        
        setIsModalOpen(true);
    };

    return (
        <section className="mb-20 p-4 bg-gray-900 rounded-xl shadow-lg m-4">
            <h2 className="text-xl font-bold mb-4 flex items-center text-gray-300">
                <Clock size={20} className="mr-2 text-red-400" />
                最新の売上履歴 (直近5件)
            </h2>
            <div className="space-y-3">
                {sales.slice(0, 5).map(sale => {
                    const methodId = sale.payment_method_id;
                    const Icon = paymentMethodIconMap[methodId];
                    
                    return (
                        <button
                            key={sale.id}
                            onClick={() => handleEdit(sale)} 
                            className="w-full flex justify-between items-center text-sm text-gray-300 border-b border-gray-800 pb-2 hover:bg-gray-800 p-1 rounded transition"
                        >
                            
                            <div className="flex flex-col text-left">
                                <span className="flex items-center text-white font-semibold">
                                    {Icon && <Icon size={14} className={`${paymentMethodColorMap[methodId]} mr-1`} />}
                                    {paymentMethodNameMap[methodId]}
                                </span>
                                <span className="text-xs text-gray-500 mt-0.5">
                                    {new Date(sale.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                </span>
                            </div>

                            <span className="font-bold text-lg text-yellow-500 mr-4">
                                ¥{sale.amount.toLocaleString()}
                            </span>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation(); 
                                    handleDelete(sale.id);
                                }}
                                className="text-red-500 hover:text-red-400 p-1 rounded transition ml-2 flex items-center text-xs"
                                title="この売上を削除"
                            >
                                削除
                            </button>
                        </button>
                    );
                })}
            </div>
            <Link href="/history" className="mt-4 block text-center text-sm text-yellow-500 hover:text-yellow-400">
                すべての履歴を見る
            </Link>
        </section>
    );
};


// ★★★ 新規コンポーネント: 月間サマリーカード ★★★
const MonthlySummaryCard: React.FC<{
    monthlySummary: { totalSales: number; rideCount: number; periodText: string };
    monthlyTarget: number;
    achievementPercentage: number;
}> = ({ monthlySummary, monthlyTarget, achievementPercentage }) => (
    <section className="p-4 bg-gray-700 text-white m-4 rounded-xl shadow-xl">
        <h2 className="text-lg font-bold flex items-center mb-2 text-gray-200">
            <Calendar size={20} className="mr-2 text-blue-400" />
            月間売上 ({monthlySummary.periodText})
        </h2>
        <p className="text-4xl font-extrabold text-white">
            ¥{monthlySummary.totalSales.toLocaleString()}
        </p>

        {monthlyTarget > 0 && (
            <div className="mt-3">
                {/* プログレスバー (月間) */}
                <div className="w-full bg-gray-600 rounded-full h-2">
                    <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${achievementPercentage}%` }}
                    ></div>
                </div>
                {/* 達成率と目標金額 */}
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span className="font-semibold">{achievementPercentage}% 達成</span>
                    <span>目標 ¥{monthlyTarget.toLocaleString()}</span>
                </div>
            </div>
        )}
        
        <p className="text-sm text-gray-400 mt-2">
            乗車: {monthlySummary.rideCount} 回
        </p>
    </section>
);


// ★★★ 新規コンポーネント: 月間目標設定モーダル ★★★
const MonthlySettingsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    currentClosingDay: number;
    currentTarget: number;
    setClosingDay: (day: number) => void;
    setMonthlyTarget: (target: number) => void;
    fetchData: (closingDay: number) => void;
}> = ({ isOpen, onClose, currentClosingDay, currentTarget, setClosingDay, setMonthlyTarget, fetchData }) => {
    
    const [inputDay, setInputDay] = useState(String(currentClosingDay));
    const [inputTarget, setInputTarget] = useState(String(currentTarget));

    useEffect(() => {
        // モーダルが開くときに値を同期
        setInputDay(String(currentClosingDay));
        setInputTarget(String(currentTarget));
    }, [isOpen, currentClosingDay, currentTarget]);

    const handleSave = () => {
        const day = parseInt(inputDay);
        const target = parseInt(inputTarget);

        if (isNaN(day) || day < 1 || day > 31) {
            alert("締め日を1〜31日（いずれか）で入力してください。");
            return;
        }

        // 状態とLocal Storageを更新
        localStorage.setItem(LOCAL_STORAGE_CLOSING_DAY_KEY, String(day));
        localStorage.setItem(LOCAL_STORAGE_MONTHLY_TARGET_KEY, String(target));
        setClosingDay(day);
        setMonthlyTarget(target);

        // 新しい設定でデータを再取得
        fetchData(day);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm transition-opacity p-4">
            <div className="bg-gray-800 rounded-xl w-full max-w-sm p-6 shadow-2xl transform transition-transform duration-300 translate-y-0 text-white">
                
                <h2 className="text-2xl font-bold mb-4 flex items-center">
                    <Target size={24} className="mr-2 text-yellow-500" />
                    月間目標設定
                </h2>
                
                <div className="space-y-4">
                    {/* 締め日設定 */}
                    <div className="bg-gray-700 p-3 rounded-lg">
                        <label className="block text-sm font-semibold mb-1 text-gray-300">
                            月の締め日 (1〜31日)
                        </label>
                        <input
                            type="number"
                            value={inputDay}
                            onChange={(e) => setInputDay(e.target.value)}
                            min="1"
                            max="31"
                            placeholder="例: 25"
                            className="w-full bg-transparent border-b border-gray-600 focus:border-yellow-500 outline-none text-xl p-1"
                        />
                    </div>
                    
                    {/* 月間目標金額設定 */}
                    <div className="bg-gray-700 p-3 rounded-lg">
                        <label className="block text-sm font-semibold mb-1 text-gray-300">
                            月間目標金額 (¥)
                        </label>
                        <input
                            type="number"
                            value={inputTarget}
                            onChange={(e) => setInputTarget(e.target.value)}
                            placeholder="例: 600000"
                            className="w-full bg-transparent border-b border-gray-600 focus:border-yellow-500 outline-none text-xl p-1"
                        />
                    </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                    <button
                        onClick={onClose}
                        className="p-2 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg font-bold transition"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSave}
                        className="p-2 px-4 bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg font-bold transition"
                    >
                        保存して更新
                    </button>
                </div>
            </div>
        </div>
    );
};