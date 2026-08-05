import React from 'react';
import MaterialIcon from './MaterialIcon';

const ConfirmModal = ({
    isOpen,
    title = "Xác nhận",
    message = "Bạn có chắc chắn muốn thực hiện thao tác này?",
    confirmText = "Xác nhận",
    cancelText = "Hủy",
    type = "danger",
    showInput = false,
    inputPlaceholder = "Nhập thông tin...",
    inputValue = "",
    onInputChange = () => {},
    onConfirm,
    onCancel
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/20 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 transform transition-all animate-scale-up">
                
                {/* Header & Icon */}
                <div className="flex items-start space-x-3.5">
                    <div className={`p-3 rounded-2xl shrink-0 ${
                        type === 'danger' 
                            ? 'bg-error-container/40 text-error' 
                            : type === 'warning'
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-primary-container/40 text-primary'
                    }`}>
                        <MaterialIcon 
                            name={type === 'danger' ? 'delete_forever' : type === 'warning' ? 'warning' : 'help_outline'} 
                            size={24} 
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-on-surface">{title}</h3>
                        <p className="text-xs text-on-surface-variant/80 mt-1 leading-relaxed">{message}</p>
                    </div>
                </div>

                {/* Input for Prompt type */}
                {showInput && (
                    <div className="space-y-1.5 pt-1">
                        <textarea
                            value={inputValue}
                            onChange={(e) => onInputChange(e.target.value)}
                            placeholder={inputPlaceholder}
                            rows={3}
                            className="w-full bg-surface-container-high/60 dark:bg-surface-container-low/60 border border-outline-variant/20 rounded-2xl p-3 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                            autoFocus
                        />
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end space-x-3 pt-2 border-t border-outline-variant/10">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-5 py-2.5 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container-highest/60 transition cursor-pointer"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-md active:scale-95 ${
                            type === 'danger'
                                ? 'bg-error hover:bg-error/90 text-on-error'
                                : 'bg-primary hover:bg-primary/90 text-on-primary'
                        }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
