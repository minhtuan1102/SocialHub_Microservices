import React, { createContext, useContext, useState, useCallback } from 'react';
import ConfirmModal from '../components/ConfirmModal';

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
    const [modalConfig, setModalConfig] = useState(null);

    const confirm = useCallback(({
        title = "Xác nhận",
        message = "Bạn có chắc chắn muốn thực hiện thao tác này?",
        confirmText = "Xác nhận",
        cancelText = "Hủy",
        type = "danger",
        showInput = false,
        inputPlaceholder = "",
        initialInputValue = ""
    }) => {
        return new Promise((resolve) => {
            setModalConfig({
                title,
                message,
                confirmText,
                cancelText,
                type,
                showInput,
                inputPlaceholder,
                inputValue: initialInputValue,
                onConfirm: (inputValue) => {
                    setModalConfig(null);
                    resolve(showInput ? inputValue : true);
                },
                onCancel: () => {
                    setModalConfig(null);
                    resolve(false);
                }
            });
        });
    }, []);

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {modalConfig && (
                <ConfirmModal
                    isOpen={!!modalConfig}
                    title={modalConfig.title}
                    message={modalConfig.message}
                    confirmText={modalConfig.confirmText}
                    cancelText={modalConfig.cancelText}
                    type={modalConfig.type}
                    showInput={modalConfig.showInput}
                    inputPlaceholder={modalConfig.inputPlaceholder}
                    inputValue={modalConfig.inputValue}
                    onInputChange={(val) => setModalConfig(prev => ({ ...prev, inputValue: val }))}
                    onConfirm={() => modalConfig.onConfirm(modalConfig.inputValue)}
                    onCancel={() => modalConfig.onCancel()}
                />
            )}
        </ConfirmContext.Provider>
    );
};

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error("useConfirm must be used within a ConfirmProvider");
    }
    return context.confirm;
};
