// ../components/KeypadModal.tsx

import React from 'react';
import { DollarSign, Smartphone, CreditCard, Tag } from 'lucide-react';

interface KeypadModalProps {
    amount: number | '';
    paymentMethod: string;
    setPaymentMethod: (method: string) => void;
    handleRegisterSale: () => void;
    handleKeypadPress: (value: string | 'C' | 'DEL') => void;
    isLoading: boolean;
    isDisabled: boolean;
    isOpen: boolean;
    onClose: () => void;
    isEditing: boolean; 
}

const paymentMethods = [
    { key: 'cash', name: '現金', Icon: DollarSign, color: 'text-green-500' },
    { key: 'qr/other', name: 'アプリ/QR', Icon: Smartphone, color: 'text-blue-500' },
    { key: 'card', name: 'カード', Icon: CreditCard, color: 'text-red-500' },
    { key: 'ticket', name: 'チケ', Icon: Tag, color: 'text-yellow-500' },
];

export const KeypadModal: React.FC<KeypadModalProps> = ({
    amount,
    paymentMethod,
    setPaymentMethod,
    handleRegisterSale,
    handleKeypadPress,
    isLoading,
    isDisabled,
    isOpen,
    onClose,
    isEditing 
}) => {

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm transition-opacity">
            <div className="bg-gray-800 rounded-t-xl sm:rounded-xl w-full max-w-sm p-4 shadow-2xl transform transition-transform duration-300 translate-y-0">
                
                {/* ヘッダー/タイトル */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">
                        {isEditing ? '売上修正' : '新規売上登録'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        閉じる
                    </button>
                </div>

                {/* 表示金額 */}
                <div className="text-right mb-4 p-3 bg-gray-700 rounded-lg">
                    <p className="text-4xl font-extrabold text-yellow-400">
                        ¥{(amount === '' ? 0 : amount).toLocaleString()}
                    </p>
                </div>

                {/* 支払い方法選択 */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                    {paymentMethods.map(method => (
                        <button
                            key={method.key}
                            onClick={() => setPaymentMethod(method.key)}
                            className={`p-2 rounded-lg transition ${
                                paymentMethod === method.key 
                                    ? 'bg-yellow-500 text-black font-bold' 
                                    : 'bg-gray-600 text-gray-300'
                            }`}
                        >
                            <method.Icon size={20} className={`mx-auto ${paymentMethod === method.key ? 'text-black' : method.color}`} />
                            <span className="text-xs mt-1 block">{method.name}</span>
                        </button>
                    ))}
                </div>

                {/* キーパッド */}
                <div className="grid grid-cols-3 gap-2">
                    {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', 'DEL'].map(key => (
                        <button
                            key={key}
                            onClick={() => handleKeypadPress(key as any)}
                            className={`p-4 rounded-lg text-2xl font-bold transition ${
                                ['C', 'DEL'].includes(key) ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-gray-600 hover:bg-gray-500 text-white'
                            }`}
                        >
                            {key === 'C' ? 'C' : key === 'DEL' ? 'DEL' : key}
                        </button>
                    ))}
                </div>

                {/* 登録/修正ボタン */}
                <button
                    onClick={handleRegisterSale}
                    disabled={isDisabled || amount === '' || amount === 0 || isLoading}
                    className={`w-full p-3 mt-4 rounded-lg text-lg font-bold transition ${
                        isDisabled || amount === '' || amount === 0 || isLoading
                            ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}
                >
                    {isLoading ? '処理中...' : isEditing ? '修正を保存' : '登録'}
                </button>
            </div>
        </div>
    );
};