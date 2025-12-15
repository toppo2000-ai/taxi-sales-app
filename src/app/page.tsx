// src/app/page.tsx

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '../../utils/supabase';
import Link from 'next/link';

// アイコンのインポート
import { 
    CarTaxiFront, 
    Target, 
    ArrowRight, 
    X, 
    Trash2, 
    Check, 
    Pencil, 
    Clock, 
    DollarSign,
    BarChart,
    ChevronRight,
    Calendar,
    CreditCard,
    Smartphone,
    Ticket,
    Wallet,
    ListChecks // 欠落していたインポート
} from 'lucide-react';

// =================================================================
// 1. 型定義
// =================================================================

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

interface ShiftSummary {
    totalSales: number;
    rideCount: number;
    avgFare: number;
}

interface MonthlySummary {
    totalSales: number;
    totalRides: number;
}


// =================================================================
// 2. 定数・マッピング
// =================================================================

const PAYMENT_METHODS = [
    { id: 1, name: '現金', icon: Wallet, color: 'text-green-400' },
    { id: 2, name: 'アプリ/QR', icon: Smartphone, color: 'text-blue-400' },
    { id: 3, name: 'カード', icon: CreditCard, color: 'text-yellow-400' },
    { id: 4, name: 'チケ', icon: Ticket, color: 'text-red-400' },
];

const paymentMethodIconMap: { [key: number]: React.ElementType } = PAYMENT_METHODS.reduce((map, method) => {
    map[method.id] = method.icon;
    return map;
}, {} as { [key: number]: React.ElementType });

const paymentMethodColorMap: { [key: number]: string } = PAYMENT_METHODS.reduce((map, method) => {
    map[method.id] = method.color;
    return map;
}, {} as { [key: number]: string });

const paymentMethodNameMap: { [key: number]: string } = PAYMENT_METHODS.reduce((map, method) => {
    map[method.id] = method.name;
    return map;
}, {} as { [key: number]: string });


// =================================================================
// 3. メインコンポーネント (Home)
// =================================================================

export default function Home() {
    const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseClient>>(null);
    const [currentShift, setCurrentShift] = useState<Shift | null>(null);
    const [sales, setSales] = useState<Sale[]>([]);
    const [targetInput, setTargetInput] = useState<string>('30000'); // 日次目標金額の入力値
    const [isLoading, setIsLoading] = useState(true);
    const [monthlySummary, setMonthlySummary] = useState<MonthlySummary>({ totalSales: 0, totalRides: 0 });
    
    // ★ 修正点1: 月間目標値をStateとして管理
    const [monthlyTargetValue, setMonthlyTargetValue] = useState<number>(1000000); 

    // モーダル管理
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEndModalOpen, setIsEndModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);
    // ★ 修正点1: 月間目標設定モーダルのState
    const [isMonthlyTargetModalOpen, setIsMonthlyTargetModalOpen] = useState(false);

    // Supabaseクライアントの初期化 (Client Componentでのみ実行)
    useEffect(() => {
        setSupabase(getSupabaseClient());
    }, []);

    // データの取得
    const fetchData = useCallback(async () => {
        if (!supabase) return;

        setIsLoading(true);

        // 1. 現在アクティブなシフトを取得 (end_timeがNULLのもの)
        const { data: shiftData, error: shiftError } = await supabase
            .from('shifts')
            .select('*')
            .is('end_time', null)
            .limit(1);

        if (shiftError) {
            console.error('シフトデータ取得エラー:', shiftError.message);
            setIsLoading(false);
            return;
        }

        const activeShift = shiftData.length > 0 ? (shiftData[0] as Shift) : null;
        setCurrentShift(activeShift);

        // 2. 売上データを取得
        if (activeShift) {
            const { data: salesData, error: salesError } = await supabase
                .from('sales')
                .select('*')
                .eq('shift_id', activeShift.id)
                .order('created_at', { ascending: false });

            if (salesError) {
                console.error('売上データ取得エラー:', salesError.message);
                setSales([]);
            } else {
                setSales(salesData as Sale[]);
            }
        } else {
            setSales([]);
        }

        // 3. 月間サマリーを取得 (過去30日間)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();
        
        const { data: monthlyData, error: monthlyError } = await supabase
            .from('sales')
            .select('amount')
            .gte('created_at', thirtyDaysAgoISO);
            
        if (!monthlyError && monthlyData) {
            const totalSales = monthlyData.reduce((sum, sale) => sum + sale.amount, 0);
            const totalRides = monthlyData.length;
            setMonthlySummary({ totalSales, totalRides });
        }


        setIsLoading(false);
    }, [supabase]);


    useEffect(() => {
        if (supabase) fetchData();
    }, [supabase, fetchData]);


    // =================================================================
    // 4. アクション関数
    // =================================================================

    // シフト開始
    const startShift = useCallback(async () => {
        if (!supabase) return;
        const targetAmount = parseInt(targetInput, 10);

        if (isNaN(targetAmount) || targetAmount <= 0) {
            alert('目標金額を正しく入力してください。');
            return;
        }

        const newShift: Omit<Shift, 'id' | 'end_time'> = {
            start_time: new Date().toISOString(),
            target_amount: targetAmount,
        };

        const { error } = await supabase.from('shifts').insert(newShift);

        if (error) {
            alert('シフト開始に失敗しました。' + error.message);
        } else {
            await fetchData();
            alert('シフトを開始しました！頑張りましょう！');
        }
    }, [supabase, targetInput, fetchData]);


    // 売上追加
    const addSale = useCallback(async (amount: number, methodId: number) => {
        if (!supabase || !currentShift) return;

        const newSale: Omit<Sale, 'id' | 'created_at'> = {
            amount,
            payment_method_id: methodId,
            shift_id: currentShift.id,
        };

        const { error } = await supabase.from('sales').insert(newSale);

        if (error) {
            alert('売上登録に失敗しました。');
        } else {
            setIsAddModalOpen(false);
            await fetchData();
        }
    }, [supabase, currentShift, fetchData]);


    // 売上削除
    const deleteSale = useCallback(async (saleId: string) => {
        if (!supabase) return;

        const { error } = await supabase.from('sales').delete().eq('id', saleId);

        if (error) {
            alert('売上削除に失敗しました。');
        } else {
            setIsDeleteModalOpen(false);
            setSaleToDelete(null);
            await fetchData();
        }
    }, [supabase, fetchData]);

    // 売上編集
    const editSale = useCallback(async (saleId: string, newAmount: number, newMethodId: number) => {
        if (!supabase) return;

        const { error } = await supabase
            .from('sales')
            .update({ amount: newAmount, payment_method_id: newMethodId })
            .eq('id', saleId);

        if (error) {
            alert('売上編集に失敗しました。');
        } else {
            setIsEditModalOpen(false);
            setSaleToEdit(null);
            await fetchData();
        }
    }, [supabase, fetchData]);


    // シフト終了
    const endShift = useCallback(async () => {
        if (!supabase || !currentShift) return;

        const { error } = await supabase
            .from('shifts')
            .update({ end_time: new Date().toISOString() })
            .eq('id', currentShift.id);

        if (error) {
            alert('シフト終了処理に失敗しました。');
        } else {
            setIsEndModalOpen(false);
            await fetchData();
            alert(`シフト終了！総売上: ¥${shiftSummary.totalSales.toLocaleString()}`);
        }
    }, [supabase, currentShift, fetchData]);


    // =================================================================
    // 5. データ集計
    // =================================================================

    // 現在のシフトの集計
    const shiftSummary: ShiftSummary = useMemo(() => {
        const totalSales = sales.reduce((sum, sale) => sum + sale.amount, 0);
        const rideCount = sales.length;
        const avgFare = rideCount > 0 ? Math.round(totalSales / rideCount) : 0;
        return { totalSales, rideCount, avgFare };
    }, [sales]);

    const shiftAchievementPercentage = useMemo(() => {
        if (!currentShift || currentShift.target_amount === 0) return 0;
        return Math.min(100, Math.round((shiftSummary.totalSales / currentShift.target_amount) * 100));
    }, [currentShift, shiftSummary.totalSales]);

    // 月間サマリー計算
    const monthlyAchievementPercentage = useMemo(() => {
        if (monthlyTargetValue === 0) return 0 
        return Math.min(100, Math.round((monthlySummary.totalSales / monthlyTargetValue) * 100));
    }, [monthlySummary.totalSales, monthlyTargetValue]);

    // 月間集計期間の表示 (仮)
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthEnd = new Date();
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    const monthRange = `${monthStart.getMonth() + 1}/${monthStart.getDate()} 〜 ${monthEnd.getMonth() + 1}/${monthEnd.getDate()}`;


    if (isLoading) {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center text-xl font-bold">Loading...</div>;
    }

    // =================================================================
    // 6. UIレンダリング
    // =================================================================

    return (
        <div className="min-h-screen bg-black p-0 max-w-md mx-auto">
            
            {/* 画面上部のヘッダー */}
            <header className="flex justify-between items-center px-4 pt-6 pb-2 text-white">
                <div className="text-xl font-bold flex items-center">
                    <CarTaxiFront className="mr-2 text-yellow-500" />
                    TaxiApp
                </div>
                <div className="flex space-x-3 text-sm">
                    {/* ★ 修正点2: 目標ボタンにonClickハンドラを追加 */}
                    <button 
                        onClick={() => setIsMonthlyTargetModalOpen(true)}
                        className="flex items-center text-gray-400 hover:text-white transition"
                    >
                        <Target size={16} className="mr-1" /> 目標
                    </button>
                    <Link href="/analysis" className="flex items-center text-gray-400 hover:text-white transition">
                        <BarChart size={16} className="mr-1" /> 分析へ
                    </Link>
                </div>
            </header>
            
            {/* 月間サマリーセクション */}
            <MonthlySummaryCard 
                monthlySummary={monthlySummary} 
                monthlyTarget={monthlyTargetValue} // Stateを使用
                achievementPercentage={monthlyAchievementPercentage}
                monthRange={monthRange}
            />

            {/* シフト管理セクション */}
            {currentShift ? (
                // m-4 (マージン) と rounded-xl (角丸) を適用
                <section className="m-4 p-4 bg-gray-800 text-white shadow-xl rounded-xl"> 
                    
                    {/* 営業中ステータスと時刻 */}
                    <div className="flex justify-between items-center text-sm text-gray-400 font-semibold mb-2">
                        <div className="flex items-center">
                            <Clock size={16} className="mr-1 text-green-400"/>
                            営業中 ({new Date(currentShift.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })}〜)
                        </div>
                        <button 
                            onClick={() => setIsEndModalOpen(true)}
                            className="text-red-500 hover:text-red-400 transition"
                        >
                            シフト終了
                        </button>
                    </div>

                    {/* メインの売上金額 */}
                    <p className="text-6xl font-extrabold mb-4">
                        ¥{shiftSummary.totalSales.toLocaleString()}
                    </p>

                    {/* プログレスバー */}
                    <div className="w-full bg-gray-700 rounded-full h-2.5 mb-1">
                        <div 
                            className="h-2.5 rounded-full bg-yellow-500 transition-all duration-500" 
                            style={{ width: `${shiftAchievementPercentage}%` }}
                        ></div>
                    </div>
                    
                    {/* 達成率と目標金額 */}
                    <div className="flex justify-between text-xs mb-4">
                        <p className={`${shiftAchievementPercentage >= 100 ? 'text-green-400' : 'text-gray-400'} font-semibold`}>
                            {shiftAchievementPercentage}% 達成 (本日の目標)
                        </p>
                        <p className="text-gray-400">
                            目標 ¥{currentShift.target_amount.toLocaleString()}
                        </p>
                    </div>

                    {/* 乗車回数と平均単価のカード */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <StatCard icon={ListChecks} label="乗車回数" value={`${shiftSummary.rideCount} 回`} color="text-blue-400"/>
                        <StatCard icon={DollarSign} label="平均単価" value={`¥${shiftSummary.avgFare.toLocaleString()}`} color="text-red-400"/>
                    </div>

                    {/* 売上追加ボタン */}
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded-lg flex items-center justify-center transition"
                    >
                        <DollarSign size={24} className="mr-2"/>
                        売上を記録する
                    </button>
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

            {/* 直近の売上履歴 */}
            <LatestSalesHistory 
                sales={sales} 
                currentShift={currentShift}
                handleEdit={(sale) => { setSaleToEdit(sale); setIsEditModalOpen(true); }}
                handleDelete={(saleId) => { 
                    const sale = sales.find(s => s.id === saleId);
                    setSaleToDelete(sale ?? null); 
                    setIsDeleteModalOpen(true);
                }}
            />

            {/* モーダル群 */}
            <AddSaleModal 
                isOpen={isAddModalOpen} 
                onClose={() => setIsAddModalOpen(false)} 
                onAdd={addSale}
            />
            <EditSaleModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onEdit={editSale}
                sale={saleToEdit}
            />
            <DeleteSaleModal 
                isOpen={isDeleteModalOpen} 
                onClose={() => setIsDeleteModalOpen(false)}
                onDelete={() => saleToDelete && deleteSale(saleToDelete.id)}
                sale={saleToDelete}
            />
            <EndShiftModal 
                isOpen={isEndModalOpen} 
                onClose={() => setIsEndModalOpen(false)}
                onEnd={endShift}
                summary={shiftSummary}
            />

            {/* ★ 修正点3: 月間目標設定モーダルをレンダリングに追加 */}
            <MonthlyTargetModal
                isOpen={isMonthlyTargetModalOpen}
                onClose={() => setIsMonthlyTargetModalOpen(false)}
                onTargetChange={setMonthlyTargetValue} 
                currentTarget={monthlyTargetValue}
            />
        </div>
    );
}


// =================================================================
// 7. サブコンポーネント
// =================================================================

// 汎用統計表示カード
const StatCard: React.FC<{ icon: React.ElementType, label: string, value: string, color: string }> = ({ icon: Icon, label, value, color }) => (
    <div className="bg-gray-700 p-3 rounded-lg text-center">
        <Icon size={24} className={`mx-auto mb-1 ${color}`} />
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xl font-bold text-white">{value}</p>
    </div>
);

// シフト開始設定カード
const ShiftSetupCard: React.FC<{
    targetInput: string;
    setTargetInput: (value: string) => void;
    startShift: () => void;
}> = ({ targetInput, setTargetInput, startShift }) => (
    <>
        <h2 className="text-xl font-bold mb-3 flex items-center">
            <CarTaxiFront size={24} className="mr-2 text-yellow-500" />
            シフトを開始する
        </h2>
        <p className="text-sm text-gray-400 mb-4">本日の目標金額を設定してください。</p>
        <div className="flex items-center mb-6 bg-gray-800 p-3 rounded-lg">
            <DollarSign size={20} className="text-green-400 mr-2" />
            <span className="text-xl font-bold mr-2">¥</span>
            <input
                type="number"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                placeholder="目標金額 (例: 30000)"
                className="w-full bg-transparent text-white text-xl font-bold focus:outline-none"
                inputMode="numeric"
            />
        </div>
        <button
            onClick={startShift}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg flex items-center justify-center transition"
        >
            <ArrowRight size={20} className="mr-2" />
            シフト開始
        </button>
    </>
);


// 月間サマリーカード
const MonthlySummaryCard: React.FC<{
    monthlySummary: MonthlySummary;
    monthlyTarget: number;
    achievementPercentage: number;
    monthRange: string;
}> = ({ monthlySummary, monthlyTarget, achievementPercentage, monthRange }) => (
    <div className="m-4 p-4 bg-gray-800 text-white shadow-xl rounded-xl">
        <div className="flex items-center text-sm text-gray-400 mb-2">
            <Calendar size={16} className="mr-1 text-yellow-500"/>
            月間売上 ({monthRange})
        </div>
        <p className="text-4xl font-extrabold mb-1">
            ¥{monthlySummary.totalSales.toLocaleString()}
        </p>
        
        <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1">
            <div 
                className="h-1.5 rounded-full bg-blue-500 transition-all duration-500" 
                style={{ width: `${achievementPercentage}%` }}
            ></div>
        </div>
        
        <div className="flex justify-between text-xs">
            <p className="text-gray-400">
                {achievementPercentage}% 達成
            </p>
            <p className="text-gray-400">
                目標 ¥{monthlyTarget.toLocaleString()}
            </p>
        </div>
        
        <p className="text-xs text-gray-400 mt-2">
            乗車: {monthlySummary.totalRides} 回
        </p>
    </div>
);


// 直近の売上履歴コンポーネント
const LatestSalesHistory: React.FC<{
    sales: Sale[];
    currentShift: Shift | null;
    handleEdit: (sale: Sale) => void;
    handleDelete: (saleId: string) => void;
}> = ({ sales, currentShift, handleEdit, handleDelete }) => {
    
    // 内側の削除ボタンが親のクリックイベントを起動するのを防ぐ
    const stopPropagationAndDelete = (e: React.MouseEvent, saleId: string) => {
        e.stopPropagation();
        handleDelete(saleId);
    };

    return (
        <section className="mb-20 p-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">直近の売上履歴</h2>
            </div>
            
            <div className="space-y-3">
                {sales.slice(0, 5).map(sale => {
                    const methodId = sale.payment_method_id;
                    const Icon = paymentMethodIconMap[methodId];
                    
                    return (
                        <div
                            key={sale.id}
                            onClick={() => handleEdit(sale)} 
                            className="w-full flex justify-between items-center text-sm text-gray-300 border-b border-gray-800 pb-2 hover:bg-gray-800 p-1 rounded transition cursor-pointer"
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
                                onClick={(e) => stopPropagationAndDelete(e, sale.id)}
                                className="text-red-500 hover:text-red-400 p-1 rounded transition ml-2 flex items-center text-xs"
                                title="この売上を削除"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    );
                })}
                {sales.length === 0 && (
                    <p className="text-center text-gray-500 py-4">まだ売上がありません。</p>
                )}
            </div>
            
            {/* 履歴画面へのリンク */}
            <Link href="/history" className="mt-4 block text-center text-sm text-yellow-500 hover:text-yellow-400 flex items-center justify-center">
                すべての履歴を見る <ChevronRight size={16} className="ml-1"/>
            </Link>
        </section>
    );
};


// 汎用モーダルコンポーネント (画面中央配置)
const Modal: React.FC<{ isOpen: boolean; onClose: () => void; children: React.ReactNode }> = ({ isOpen, onClose, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 p-6 rounded-xl shadow-2xl w-full max-w-sm relative">
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-white transition">
                    <X size={24} />
                </button>
                {children}
            </div>
        </div>
    );
};


// 売上追加モーダル
const AddSaleModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAdd: (amount: number, methodId: number) => void;
}> = ({ isOpen, onClose, onAdd }) => {
    const [amount, setAmount] = useState(0); // number型に変更
    const [methodId, setMethodId] = useState(PAYMENT_METHODS[0].id);
    const [isKeypadOpen, setIsKeypadOpen] = useState(false); // KeypadモーダルのState

    const handleSubmit = () => {
        if (amount <= 0) {
            alert('金額を正しく入力してください。');
            return;
        }
        onAdd(amount, methodId);
        setAmount(0);
    };
    
    useEffect(() => {
        if (!isOpen) {
            setAmount(0);
            setMethodId(PAYMENT_METHODS[0].id);
        }
    }, [isOpen]);

    return (
        <>
            <Modal isOpen={isOpen && !isKeypadOpen} onClose={onClose}>
                <h2 className="text-2xl font-bold mb-4 text-white">売上を記録</h2>
                
                {/* 金額表示とキーパッド起動ボタン */}
                <label className="block text-sm font-medium text-gray-400 mb-1">金額 (¥)</label>
                <button
                    onClick={() => setIsKeypadOpen(true)}
                    className="w-full flex items-center justify-between mb-4 bg-gray-800 p-3 rounded-lg hover:bg-gray-700 transition"
                >
                    <div className="flex items-center">
                        <DollarSign size={20} className="text-green-400 mr-2" />
                        <span className="text-white text-xl font-bold">
                            {amount > 0 ? amount.toLocaleString() : '金額を入力'}
                        </span>
                    </div>
                    <ChevronRight size={20} className="text-gray-400" />
                </button>
                
                <label className="block text-sm font-medium text-gray-400 mb-2">支払い方法</label>
                <div className="grid grid-cols-2 gap-3 mb-6">
                    {PAYMENT_METHODS.map(method => (
                        <button
                            key={method.id}
                            onClick={() => setMethodId(method.id)}
                            className={`p-3 rounded-lg flex items-center justify-center text-sm font-semibold transition ${
                                methodId === method.id 
                                    ? 'bg-yellow-500 text-black' 
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            <method.icon size={18} className="mr-2"/>
                            {method.name}
                        </button>
                    ))}
                </div>
                
                <button
                    onClick={handleSubmit}
                    disabled={amount === 0}
                    className={`w-full font-bold py-3 rounded-lg flex items-center justify-center transition ${
                        amount > 0 
                            ? 'bg-green-500 hover:bg-green-600 text-white' 
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                >
                    <Check size={20} className="mr-2"/>
                    記録を確定
                </button>
            </Modal>

            {/* キーパッドモーダル */}
            <KeypadModal
                isOpen={isKeypadOpen}
                onClose={() => setIsKeypadOpen(false)}
                currentAmount={amount}
                onAmountChange={setAmount}
            />
        </>
    );
};

// 売上編集モーダル
const EditSaleModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onEdit: (saleId: string, newAmount: number, newMethodId: number) => void;
    sale: Sale | null;
}> = ({ isOpen, onClose, onEdit, sale }) => {
    const [amount, setAmount] = useState('');
    const [methodId, setMethodId] = useState(PAYMENT_METHODS[0].id);

    useEffect(() => {
        if (sale) {
            setAmount(sale.amount.toString());
            setMethodId(sale.payment_method_id);
        }
    }, [sale]);

    const handleSubmit = () => {
        if (!sale) return;
        const parsedAmount = parseInt(amount, 10);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            alert('金額を正しく入力してください。');
            return;
        }
        onEdit(sale.id, parsedAmount, methodId);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h2 className="text-2xl font-bold mb-4 text-white flex items-center">
                <Pencil size={24} className="mr-2 text-yellow-500"/>
                売上を編集
            </h2>
            <p className="text-sm text-gray-400 mb-4">売上ID: {sale?.id.substring(0, 8)}...</p>

            <label className="block text-sm font-medium text-gray-400 mb-1">金額 (¥)</label>
            <div className="flex items-center mb-4 bg-gray-800 p-3 rounded-lg">
                <DollarSign size={20} className="text-green-400 mr-2" />
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="例: 1500"
                    className="w-full bg-transparent text-white text-xl font-bold focus:outline-none"
                    inputMode="numeric"
                />
            </div>
            
            <label className="block text-sm font-medium text-gray-400 mb-2">支払い方法</label>
            <div className="grid grid-cols-2 gap-3 mb-6">
                {PAYMENT_METHODS.map(method => (
                    <button
                        key={method.id}
                        onClick={() => setMethodId(method.id)}
                        className={`p-3 rounded-lg flex items-center justify-center text-sm font-semibold transition ${
                            methodId === method.id 
                                ? 'bg-yellow-500 text-black' 
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                        <method.icon size={18} className="mr-2"/>
                        {method.name}
                    </button>
                ))}
            </div>
            
            <button
                onClick={handleSubmit}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded-lg flex items-center justify-center transition"
            >
                <Check size={20} className="mr-2"/>
                変更を保存
            </button>
        </Modal>
    );
};


// 売上削除確認モーダル
const DeleteSaleModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onDelete: () => void;
    sale: Sale | null;
}> = ({ isOpen, onClose, onDelete, sale }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h2 className="text-2xl font-bold mb-4 text-red-500 flex items-center">
                <Trash2 size={24} className="mr-2"/>
                売上削除の確認
            </h2>
            <p className="text-white mb-6">
                以下の売上記録を削除します。よろしいですか？
            </p>
            <div className="bg-gray-800 p-3 rounded-lg mb-6">
                <p className="text-xl font-bold text-yellow-500">¥{sale?.amount.toLocaleString()}</p>
                <p className="text-sm text-gray-400">{paymentMethodNameMap[sale?.payment_method_id ?? 1]}</p>
                <p className="text-xs text-gray-500">{new Date(sale?.created_at ?? '').toLocaleString()}</p>
            </div>

            <div className="flex justify-between space-x-3">
                <button
                    onClick={onClose}
                    className="w-1/2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition"
                >
                    キャンセル
                </button>
                <button
                    onClick={onDelete}
                    className="w-1/2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition flex items-center justify-center"
                >
                    <Trash2 size={20} className="mr-2"/>
                    削除を確定
                </button>
            </div>
        </Modal>
    );
};

// シフト終了モーダル
const EndShiftModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onEnd: () => void;
    summary: ShiftSummary;
}> = ({ isOpen, onClose, onEnd, summary }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h2 className="text-2xl font-bold mb-4 text-white flex items-center">
                <Clock size={24} className="mr-2 text-red-500"/>
                シフトを終了しますか？
            </h2>
            <p className="text-gray-400 mb-6">
                本日の稼働を終了し、結果を記録します。
            </p>

            <div className="bg-gray-800 p-4 rounded-xl mb-6">
                <p className="text-sm text-gray-400 mb-1">最終総売上</p>
                <p className="text-3xl font-extrabold text-yellow-500 mb-3">¥{summary.totalSales.toLocaleString()}</p>
                <div className="flex justify-between text-sm text-gray-300">
                    <p>乗車回数: {summary.rideCount} 回</p>
                    <p>平均単価: ¥{summary.avgFare.toLocaleString()}</p>
                </div>
            </div>

            <div className="flex justify-between space-x-3">
                <button
                    onClick={onClose}
                    className="w-1/2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition"
                >
                    キャンセル
                </button>
                <button
                    onClick={onEnd}
                    className="w-1/2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition flex items-center justify-center"
                >
                    <Check size={20} className="mr-2"/>
                    終了を確定
                </button>
            </div>
        </Modal>
    );
};


// =================================================================
// ★ 月間目標設定モーダル (MonthlyTargetModal)
// =================================================================

const MonthlyTargetModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onTargetChange: (newTarget: number) => void; 
    currentTarget: number;
}> = ({ isOpen, onClose, onTargetChange, currentTarget }) => {
    const [input, setInput] = useState(currentTarget.toString());

    useEffect(() => {
        if (isOpen) {
            setInput(currentTarget.toString());
        }
    }, [isOpen, currentTarget]);

    const handleSubmit = () => {
        const newTarget = parseInt(input, 10);
        if (isNaN(newTarget) || newTarget <= 0) {
            alert('目標金額を正しく入力してください。');
            return;
        }
        // Stateを更新 (本来はデータストアに保存すべきですが、ここではStateのみ更新)
        onTargetChange(newTarget); 
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h2 className="text-2xl font-bold mb-4 text-white flex items-center">
                <Target size={24} className="mr-2 text-yellow-500"/>
                月間目標を設定
            </h2>
            
            <p className="text-sm text-gray-400 mb-4">
                月間の目標売上金額を入力してください。
            </p>

            <label className="block text-sm font-medium text-gray-400 mb-1">目標金額 (¥)</label>
            <div className="flex items-center mb-6 bg-gray-800 p-3 rounded-lg">
                <DollarSign size={20} className="text-green-400 mr-2" />
                <span className="text-xl font-bold mr-2">¥</span>
                <input
                    type="number"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="例: 600000"
                    className="w-full bg-transparent text-white text-xl font-bold focus:outline-none"
                    inputMode="numeric"
                />
            </div>

            <button
                onClick={handleSubmit}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded-lg flex items-center justify-center transition"
            >
                <Check size={20} className="mr-2"/>
                目標を保存
            </button>
        </Modal>
    );
};


// =================================================================
// ★ KeypadModal コンポーネント (画面下部スライドイン、モバイル最適)
// =================================================================

const KeypadModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    currentAmount: number;
    onAmountChange: (newAmount: number) => void;
}> = ({ isOpen, onClose, currentAmount, onAmountChange }) => {

    const [display, setDisplay] = useState(currentAmount > 0 ? currentAmount.toString() : '');

    useEffect(() => {
        if (isOpen) {
            setDisplay(currentAmount > 0 ? currentAmount.toString() : '');
        }
    }, [isOpen, currentAmount]);

    const handleInput = (value: string) => {
        if (value === 'C') {
            setDisplay('');
        } else if (value === 'DEL') {
            setDisplay(prev => prev.slice(0, -1));
        } else if (value === '00') {
            setDisplay(prev => (prev === '0' || prev === '') ? '0' : prev + '00');
        } else if (display.length < 9) { // 桁数制限
            setDisplay(prev => (prev === '0' || prev === '') ? value : prev + value);
        }
    };

    const handleConfirm = () => {
        const amount = parseInt(display || '0', 10);
        if (amount > 0) {
            onAmountChange(amount);
            onClose();
        }
    };

    const keypadLayout = [
        ['1', '2', '3', 'DEL'],
        ['4', '5', '6', 'C'],
        ['7', '8', '9', '00'],
        ['0', '確定']
    ];

    if (!isOpen) return null;

    return (
        // モバイルで使いやすい画面下部からのスライドイン効果を模倣
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-end justify-center z-50 p-0">
            <div className="bg-gray-900 p-4 rounded-t-xl shadow-2xl w-full max-w-sm relative">
                <div className="mb-4">
                    <p className="text-sm text-gray-400">金額入力</p>
                    <div className="text-4xl font-extrabold text-white text-right py-2 bg-gray-800 rounded px-3">
                        ¥{parseInt(display || '0', 10).toLocaleString()}
                    </div>
                </div>
                
                <div className="grid grid-cols-4 gap-2">
                    {keypadLayout.flat().map((key, index) => {
                        const isConfirm = key === '確定';
                        return (
                            <button
                                key={index}
                                onClick={() => isConfirm ? handleConfirm() : handleInput(key)}
                                className={`
                                    p-4 rounded-lg text-2xl font-bold transition 
                                    ${isConfirm 
                                        ? 'col-span-2 bg-green-500 hover:bg-green-600 text-white' 
                                        : (key === 'C' || key === 'DEL' 
                                            ? 'bg-red-700 hover:bg-red-600 text-white' 
                                            : 'bg-gray-700 hover:bg-gray-600 text-white')}
                                `}
                                style={{ height: '60px' }}
                                disabled={isConfirm && parseInt(display || '0', 10) === 0}
                            >
                                {key}
                            </button>
                        );
                    })}
                </div>
                <button onClick={onClose} className="w-full mt-3 p-2 text-sm text-gray-400 hover:text-white">
                    キャンセル
                </button>
            </div>
        </div>
    );
};