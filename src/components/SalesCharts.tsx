// src/components/SalesCharts.tsx

"use client";

import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';

// データ型定義 (analysis/page.tsxから再利用)
interface Shift {
    id: string;
    start_time: string;
    end_time: string | null;
    target_amount: number;
    sales: { amount: number; payment_method_id: number; }[];
}

interface ChartProps {
    shifts: Shift[];
}

const COLORS = ['#FFBB28', '#00C49F', '#FF8042', '#0088FE', '#A288E8'];

// 日別売上データ整形
const getDailySalesData = (shifts: Shift[]) => {
    // 完了したシフトのみを対象
    const completedShifts = shifts.filter(s => s.end_time !== null);

    // 過去7件の完了シフトに限定
    const recentShifts = completedShifts.slice(0, 7); 

    return recentShifts.map(shift => {
        const date = new Date(shift.start_time).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' });
        const totalSales = shift.sales.reduce((sum, sale) => sum + sale.amount, 0);
        return {
            date: date,
            売上: totalSales,
            目標: shift.target_amount,
        };
    }).reverse(); // 古い順に表示
};

// 支払い方法別データ整形
const getPaymentBreakdownData = (shifts: Shift[]) => {
    const breakdown: { [key: number]: number } = {};
    
    // 全てのシフトの売上を集計
    shifts.forEach(shift => {
        shift.sales.forEach(sale => {
            breakdown[sale.payment_method_id] = (breakdown[sale.payment_method_id] || 0) + sale.amount;
        });
    });

    const paymentNameMap: { [key: number]: string } = {
        1: '現金', 2: 'アプリ/QR', 3: 'カード', 4: 'チケ'
    };

    return Object.entries(breakdown).map(([id, value]) => ({
        name: paymentNameMap[parseInt(id)] || 'その他',
        value: value,
    })).filter(item => item.value > 0);
};

// ★★★ メインチャートコンポーネント ★★★
export const SalesCharts: React.FC<ChartProps> = ({ shifts }) => {
    
    // データがない場合は描画しない
    if (shifts.length === 0) return null;

    const dailyData = getDailySalesData(shifts);
    const paymentData = getPaymentBreakdownData(shifts);

    return (
        <div className="space-y-12">
            
            {/* 1. 日別売上推移グラフ (棒グラフ) */}
            <div>
                <h3 className="text-xl font-bold mb-4 flex items-center">日別売上と目標達成 (直近7シフト)</h3>
                <div className="bg-gray-900 p-4 rounded-xl h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="date" stroke="#999" />
                            <YAxis stroke="#999" tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                formatter={(value, name) => [`¥${value.toLocaleString()}`, name]}
                            />
                            <Legend />
                            <Bar dataKey="売上" fill="#FFBB28" />
                            <Bar dataKey="目標" fill="#FF8042" opacity={0.5} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 2. 支払い方法別割合 (円グラフ) */}
            <div>
                <h3 className="text-xl font-bold mb-4 flex items-center">支払い方法別売上割合</h3>
                <div className="bg-gray-900 p-4 rounded-xl h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={paymentData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                fill="#8884d8"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            >
                                {paymentData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                formatter={(value, name) => [`¥${value.toLocaleString()}`, name]}
                            />
                            <Legend layout="horizontal" align="center" verticalAlign="bottom" />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};