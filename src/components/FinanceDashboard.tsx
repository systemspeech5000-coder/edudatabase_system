import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toJpeg } from 'html-to-image';

import {
    type ExpenseRecord,
    type FinanceRecord,
    type IncomeRecord,
    type SavedFinanceReport,
    saveFinanceReportToFirebase,
    getFinanceReportGalleryFromFirebase,
} from '../services/financeStorage';

const STORAGE_KEY = 'voxmonitor_finance_records';

const expenseMinorCategoryOptions = [
    '임차료',
    '관리비&용역,금융 등 수수료(지급수수료)',
    '세금,공과금(제세공과금)',
    '기업업무추진비',
    '소모품비',
    '여비교통비',
    '광고선전비',
    '운반비',
    '복리후생비',
    '접대비,축의금 등(기타(비용))',
    '상품 매입',
    '재료 매입',
    '제조노무비',
    '제조 경비',
    '급료',
    '지급이자',
    '기부금',
    '차량유지비',
];

const incomeMinorCategoryOptions = ['매출', '기타(수입)'];

const noteOptions = [
    '계좌이체',
    '현금영수증',
    '신용카드',
    '세금계산서',
    '계산서',
    '간이영수증',
    '기타',
];

const getCurrentMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

const createId = () => {
    return `finance_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

const toNumber = (value: string) => {
    const onlyNumber = value.replace(/,/g, '');

    if (onlyNumber === '') return 0;

    const numberValue = Number(onlyNumber);
    return Number.isNaN(numberValue) ? 0 : numberValue;
};

const formatMoneyInput = (value: number) => {
    if (!value) return '';
    return value.toLocaleString('ko-KR');
};

const formatWon = (value: number) => {
    return `${value.toLocaleString('ko-KR')}원`;
};

const escapeExcelCell = (value: string | number) => {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
};

const downloadExcelFile = (
    fileName: string,
    sheetTitle: string,
    headers: string[],
    rows: Array<Array<string | number>>
) => {
    const tableRows = rows
        .map(
            (row) =>
                `<tr>${row
                    .map(
                        (cell) =>
                            `<td style="border:1px solid #d9d9d9;padding:6px;">${escapeExcelCell(cell)}</td>`
                    )
                    .join('')}</tr>`
        )
        .join('');

    const tableHeaders = headers
        .map(
            (header) =>
                `<th style="border:1px solid #d9d9d9;padding:6px;background:#f1f5f9;font-weight:bold;">${escapeExcelCell(header)}</th>`
        )
        .join('');

    const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
      </head>
      <body>
        <h3>${escapeExcelCell(sheetTitle)}</h3>
        <table>
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
    </html>
  `;

    const blob = new Blob([html], {
        type: 'application/vnd.ms-excel;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${fileName}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const FinanceDashboard: React.FC = () => {
    const reportRef = useRef<HTMLDivElement | null>(null);

    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    const [records, setRecords] = useState<FinanceRecord[]>([]);
    const [isStorageLoaded, setIsStorageLoaded] = useState(false);

    const [savedReports, setSavedReports] = useState<SavedFinanceReport[]>([]);
    const [gallerySearchMonth, setGallerySearchMonth] = useState('');
    const [appliedGallerySearchMonth, setAppliedGallerySearchMonth] = useState('');
    const [statsStartMonth, setStatsStartMonth] = useState(`${new Date().getFullYear()}-01`);
    const [statsEndMonth, setStatsEndMonth] = useState(`${new Date().getFullYear()}-12`);
    const [appliedStatsPeriod, setAppliedStatsPeriod] = useState<{
        startMonth: string;
        endMonth: string;
    } | null>(null);
    const [statsMessage, setStatsMessage] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');


    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);

            if (!saved) {
                setIsStorageLoaded(true);
                return;
            }

            const parsed = JSON.parse(saved);

            if (Array.isArray(parsed)) {
                const normalizedRecords = parsed.map((record) => {
                    if (record.type === 'expense') {
                        return {
                            ...record,
                            majorCategory: '비용',
                            supplyAmount: Number(record.supplyAmount) || 0,
                        } as ExpenseRecord;
                    }

                    if (record.type === 'income') {
                        const supplyAmount = Number(record.supplyAmount) || 0;
                        const vat = Number(record.vat) || 0;

                        return {
                            ...record,
                            majorCategory: '수입',
                            supplyAmount,
                            vat,
                            netProfit: supplyAmount - vat,
                        } as IncomeRecord;
                    }

                    return record;
                });

                setRecords(normalizedRecords);
            }
        } catch (error) {
            console.error('Finance records load error:', error);
            setRecords([]);
        } finally {
            setIsStorageLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!isStorageLoaded) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }, [records, isStorageLoaded]);

    useEffect(() => {
        let isMounted = true;

        const loadSavedReports = async () => {
            try {
                const reports = await getFinanceReportGalleryFromFirebase();

                if (isMounted) {
                    setSavedReports(reports);
                }
            } catch (error) {
                console.error('저장된 수입 및 비용 JPG 목록을 불러오지 못했습니다:', error);
            }
        };

        loadSavedReports();

        return () => {
            isMounted = false;
        };
    }, []);

    const incomeRecords = useMemo(() => {
        return records.filter(
            (record): record is IncomeRecord =>
                record.type === 'income' && record.date.startsWith(selectedMonth)
        );
    }, [records, selectedMonth]);

    const expenseRecords = useMemo(() => {
        return records.filter(
            (record): record is ExpenseRecord =>
                record.type === 'expense' && record.date.startsWith(selectedMonth)
        );
    }, [records, selectedMonth]);

    const monthlyRecords = useMemo(() => {
        return records.filter((record) => record.date.startsWith(selectedMonth));
    }, [records, selectedMonth]);

    const summary = useMemo(() => {
        const incomeSupplyTotal = incomeRecords.reduce((sum, record) => sum + record.supplyAmount, 0);
        const incomeVatTotal = incomeRecords.reduce((sum, record) => sum + record.vat, 0);
        const incomeNetProfitTotal = incomeRecords.reduce((sum, record) => sum + record.netProfit, 0);
        const expenseSupplyTotal = expenseRecords.reduce((sum, record) => sum + record.supplyAmount, 0);

        return {
            incomeSupplyTotal,
            incomeVatTotal,
            incomeNetProfitTotal,
            expenseSupplyTotal,
            finalProfit: incomeNetProfitTotal - expenseSupplyTotal,
        };
    }, [incomeRecords, expenseRecords]);


    const periodStats = useMemo(() => {
        if (!appliedStatsPeriod) {
            return null;
        }

        const periodRecords = records.filter((record) => {
            const recordMonth = record.date.slice(0, 7);

            return (
                recordMonth >= appliedStatsPeriod.startMonth &&
                recordMonth <= appliedStatsPeriod.endMonth
            );
        });

        const periodIncomeRecords = periodRecords.filter(
            (record): record is IncomeRecord => record.type === 'income'
        );

        const periodExpenseRecords = periodRecords.filter(
            (record): record is ExpenseRecord => record.type === 'expense'
        );

        const incomeNetProfitTotal = periodIncomeRecords.reduce(
            (sum, record) => sum + record.netProfit,
            0
        );

        const expenseSupplyTotal = periodExpenseRecords.reduce(
            (sum, record) => sum + record.supplyAmount,
            0
        );

        const monthlyStats: Array<{
            month: string;
            incomeNetProfitTotal: number;
            expenseSupplyTotal: number;
            finalProfit: number;
        }> = [];

        const startDate = new Date(`${appliedStatsPeriod.startMonth}-01`);
        const endDate = new Date(`${appliedStatsPeriod.endMonth}-01`);

        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const monthKey = `${year}-${month}`;

            const monthIncomeRecords = periodIncomeRecords.filter((record) =>
                record.date.startsWith(monthKey)
            );

            const monthExpenseRecords = periodExpenseRecords.filter((record) =>
                record.date.startsWith(monthKey)
            );

            const monthIncomeNetProfitTotal = monthIncomeRecords.reduce(
                (sum, record) => sum + record.netProfit,
                0
            );

            const monthExpenseSupplyTotal = monthExpenseRecords.reduce(
                (sum, record) => sum + record.supplyAmount,
                0
            );

            monthlyStats.push({
                month: monthKey,
                incomeNetProfitTotal: monthIncomeNetProfitTotal,
                expenseSupplyTotal: monthExpenseSupplyTotal,
                finalProfit: monthIncomeNetProfitTotal - monthExpenseSupplyTotal,
            });

            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        return {
            incomeNetProfitTotal,
            expenseSupplyTotal,
            finalProfit: incomeNetProfitTotal - expenseSupplyTotal,
            incomeCount: periodIncomeRecords.length,
            expenseCount: periodExpenseRecords.length,
            totalCount: periodRecords.length,
            monthlyStats,
        };
    }, [records, appliedStatsPeriod]);
    const handleStatsSearch = () => {
        if (!statsStartMonth || !statsEndMonth) {
            setStatsMessage('시작 월과 종료 월을 모두 선택해주세요.');
            return;
        }

        if (statsStartMonth > statsEndMonth) {
            setStatsMessage('시작 월은 종료 월보다 늦을 수 없습니다.');
            return;
        }

        setAppliedStatsPeriod({
            startMonth: statsStartMonth,
            endMonth: statsEndMonth,
        });
        setStatsMessage('');
    };


    const filteredSavedReports = useMemo(() => {
        if (!appliedGallerySearchMonth) {
            return savedReports;
        }

        return savedReports.filter((report) => report.month === appliedGallerySearchMonth);
    }, [savedReports, appliedGallerySearchMonth]);

    const addExpenseRow = () => {
        const newRecord: ExpenseRecord = {
            id: createId(),
            type: 'expense',
            date: `${selectedMonth}-01`,
            majorCategory: '비용',
            minorCategory: '',
            description: '',
            partnerName: '',
            supplyAmount: 0,
            note: '',
        };

        setRecords((prev) => [...prev, newRecord]);
    };

    const addIncomeRow = () => {
        const newRecord: IncomeRecord = {
            id: createId(),
            type: 'income',
            date: `${selectedMonth}-01`,
            majorCategory: '수입',
            minorCategory: '',
            description: '',
            partnerName: '',
            supplyAmount: 0,
            vat: 0,
            netProfit: 0,
            note: '',
        };

        setRecords((prev) => [...prev, newRecord]);
    };

    const updateTextField = (
        id: string,
        field: 'date' | 'minorCategory' | 'description' | 'partnerName' | 'note',
        value: string
    ) => {
        setRecords((prev) =>
            prev.map((record) =>
                record.id === id
                    ? {
                        ...record,
                        [field]: value,
                    }
                    : record
            )
        );
    };

    const updateExpenseAmount = (id: string, value: string) => {
        const numberValue = toNumber(value);

        setRecords((prev) =>
            prev.map((record) => {
                if (record.id !== id || record.type !== 'expense') return record;

                return {
                    ...record,
                    majorCategory: '비용',
                    supplyAmount: numberValue,
                };
            })
        );
    };

    const updateIncomeNumber = (
        id: string,
        field: 'supplyAmount' | 'vat',
        value: string
    ) => {
        const numberValue = toNumber(value);

        setRecords((prev) =>
            prev.map((record) => {
                if (record.id !== id || record.type !== 'income') return record;

                const nextSupplyAmount =
                    field === 'supplyAmount' ? numberValue : record.supplyAmount;

                const nextVat =
                    field === 'vat' ? numberValue : record.vat;

                return {
                    ...record,
                    majorCategory: '수입',
                    supplyAmount: nextSupplyAmount,
                    vat: nextVat,
                    netProfit: nextSupplyAmount - nextVat,
                };
            })
        );
    };

    const deleteRecord = (id: string) => {
        setRecords((prev) => prev.filter((record) => record.id !== id));
    };

    const downloadExpenseExcel = () => {
        const headers = [
            '번호',
            '날짜',
            '계정과목_대',
            '계정과목_소',
            '거래내용',
            '거래처(이름)',
            '금액(공급가액)',
            '비고(처리방법)',
        ];

        const rows = expenseRecords.map((record, index) => [
            index + 1,
            record.date,
            '비용',
            record.minorCategory,
            record.description,
            record.partnerName,
            record.supplyAmount,
            record.note,
        ]);

        downloadExcelFile(
            `${selectedMonth}_비용입력표`,
            `${selectedMonth} 비용 입력표`,
            headers,
            rows
        );
    };

    const downloadIncomeExcel = () => {
        const headers = [
            '번호',
            '날짜',
            '계정과목_대',
            '계정과목_소',
            '거래내용',
            '거래처(이름)',
            '금액(공급가액)',
            'VAT',
            '순이익',
            '비고(처리방법)',
        ];

        const rows = incomeRecords.map((record, index) => [
            index + 1,
            record.date,
            '수입',
            record.minorCategory,
            record.description,
            record.partnerName,
            record.supplyAmount,
            record.vat,
            record.netProfit,
            record.note,
        ]);

        downloadExcelFile(
            `${selectedMonth}_수입입력표`,
            `${selectedMonth} 수입 입력표`,
            headers,
            rows
        );
    };

    const handleSaveToFirebase = async () => {
        if (!reportRef.current) {
            setSaveMessage('저장할 화면을 찾지 못했습니다.');
            return;
        }

        setIsSaving(true);
        setSaveMessage('');

        try {
            const imageDataUrl = await toJpeg(reportRef.current, {
                quality: 0.95,
                backgroundColor: '#ffffff',
                pixelRatio: 2,
            });

            const report = await saveFinanceReportToFirebase({
                month: selectedMonth,
                records: monthlyRecords,
                summary,
                imageDataUrl,
            });

            setSavedReports((prev) => [report, ...prev]);
            setSaveMessage('저장되었습니다.');
        } catch (error) {
            console.error(error);
            setSaveMessage('저장에 실패했습니다. Firebase 설정과 권한을 확인해주세요.');
        } finally {
            setIsSaving(false);
        }
    };

    const baseInputStyle: React.CSSProperties = {
        width: '100%',
        height: '38px',
        border: 'none',
        borderRadius: 0,
        padding: '0 0.45rem',
        fontSize: '0.95rem',
        fontWeight: 750,
        color: '#334155',
        boxSizing: 'border-box',
        outline: 'none',
        background: 'transparent',
    };

    const readonlyCellTextStyle: React.CSSProperties = {
        ...baseInputStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 950,
    };

    const numberInputStyle: React.CSSProperties = {
        ...baseInputStyle,
        textAlign: 'right',
        paddingRight: '0.45rem',
    };

    const selectStyle: React.CSSProperties = {
        ...baseInputStyle,
        cursor: 'pointer',
        appearance: 'auto',
    };

    const thStyle: React.CSSProperties = {
        padding: '0.6rem 0.25rem',
        background: '#f8fafc',
        color: '#334155',
        fontSize: '0.87rem',
        fontWeight: 950,
        border: '1px solid #e2e8f0',
        whiteSpace: 'nowrap',
        textAlign: 'center',
    };

    const tdStyle: React.CSSProperties = {
        padding: '0.2rem 0.24rem',
        border: '1px solid #e5e7eb',
        verticalAlign: 'middle',
        background: 'rgba(255, 255, 255, 0.88)',
    };

    const sectionStyle: React.CSSProperties = {
        border: '1px solid #e2e8f0',
        borderRadius: '22px',
        padding: '1.05rem',
        background: '#ffffff',
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.045)',
    };

    const expenseSectionStyle: React.CSSProperties = {
        ...sectionStyle,
        border: '1px solid #fed7aa',
        background: 'linear-gradient(135deg, #fffaf5 0%, #fff7ed 100%)',
    };

    const incomeSectionStyle: React.CSSProperties = {
        ...sectionStyle,
        border: '1px solid #bbf7d0',
        background: 'linear-gradient(135deg, #f7fef9 0%, #ecfdf5 100%)',
    };

    const summaryCardStyle: React.CSSProperties = {
        border: '1px solid #e2e8f0',
        borderRadius: '18px',
        padding: '0.95rem',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        boxShadow: '0 8px 18px rgba(15, 23, 42, 0.045)',
    };

    const expenseSummaryCardStyle: React.CSSProperties = {
        ...summaryCardStyle,
        border: '1px solid #fed7aa',
        background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)',
    };

    const incomeSummaryCardStyle: React.CSSProperties = {
        ...summaryCardStyle,
        border: '1px solid #bbf7d0',
        background: 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)',
    };

    const deleteButtonStyle: React.CSSProperties = {
        width: '100%',
        height: '34px',
        border: '1px solid #fecdd3',
        borderRadius: '10px',
        background: '#fff1f2',
        color: '#be123c',
        fontSize: '0.84rem',
        fontWeight: 900,
        cursor: 'pointer',
    };

    const addButtonStyle: React.CSSProperties = {
        border: '1px solid #cbd5e1',
        borderRadius: '999px',
        padding: '0.62rem 0.95rem',
        background: '#ffffff',
        color: '#334155',
        fontSize: '0.9rem',
        fontWeight: 950,
        cursor: 'pointer',
        boxShadow: '0 6px 14px rgba(15, 23, 42, 0.05)',
    };

    const saveButtonStyle: React.CSSProperties = {
        border: '1px solid #d8b4fe',
        borderRadius: '999px',
        padding: '0.76rem 1.5rem',
        background: 'linear-gradient(135deg, #f5f3ff 0%, #fdf2f8 100%)',
        color: '#6d28d9',
        fontSize: '0.96rem',
        fontWeight: 950,
        cursor: 'pointer',
        boxShadow: '0 8px 18px rgba(124, 58, 237, 0.12)',
        letterSpacing: '-0.01em',
    };

    const excelButtonStyle: React.CSSProperties = {
        border: '1px solid #bbf7d0',
        borderRadius: '999px',
        padding: '0.56rem 0.9rem',
        background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
        color: '#166534',
        fontSize: '0.86rem',
        fontWeight: 950,
        cursor: 'pointer',
        boxShadow: '0 6px 14px rgba(22, 101, 52, 0.08)',
    };

    const gallerySearchButtonStyle: React.CSSProperties = {
        border: '1px solid #e2e8f0',
        borderRadius: '999px',
        padding: '0.58rem 0.9rem',
        background: '#f8fafc',
        color: '#64748b',
        fontWeight: 900,
        cursor: 'pointer',
    };

    const tableStyle: React.CSSProperties = {
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        background: '#ffffff',
    };

    return (
        <div
            className="coach-dashboard-wrapper animate-fade-in"
            style={{
                width: '100%',
                maxWidth: '1500px',
                margin: '0 auto',
            }}
        >
            <div
                ref={reportRef}
                className="card"
                style={{
                    marginBottom: '1.2rem',
                    height: 'auto',
                    maxHeight: 'none',
                    overflow: 'visible',
                    width: '100%',
                    borderRadius: '28px',
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    boxShadow: '0 18px 46px rgba(15, 23, 42, 0.06)',
                }}
            >
                <div
                    className="details-header"
                    style={{
                        marginBottom: '1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                    }}
                >
                    <div>
                        <h2 style={{ fontSize: '1.55rem', marginBottom: '0.35rem', color: '#334155' }}>
                            💰 비용 및 수입관리
                        </h2>
                        <p style={{ fontSize: '0.95rem', color: '#64748b', margin: 0, fontWeight: 750 }}>
                            월별 수입과 비용을 정리합니다.
                        </p>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.65rem',
                            padding: '0.65rem 0.9rem',
                            borderRadius: '18px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                        }}
                    >
                        <label
                            htmlFor="finance-month"
                            style={{
                                color: '#334155',
                                fontSize: '0.92rem',
                                fontWeight: 950,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            관리 월
                        </label>

                        <input
                            id="finance-month"
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value || getCurrentMonth())}
                            style={{
                                width: '150px',
                                minWidth: '150px',
                                height: '38px',
                                borderRadius: '12px',
                                border: '1.5px solid #cbd5e1',
                                background: '#ffffff',
                                padding: '0 0.5rem',
                                color: '#334155',
                                fontSize: '0.94rem',
                                fontWeight: 850,
                                outline: 'none',
                            }}
                        />
                    </div>
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: '0.75rem',
                        marginBottom: '1.2rem',
                    }}
                >
                    <div style={summaryCardStyle}>
                        <p style={{ margin: 0, color: '#64748b', fontWeight: 900, fontSize: '0.82rem' }}>
                            수입 공급가액 합계
                        </p>
                        <h3 style={{ margin: '0.35rem 0 0', color: '#334155', fontSize: '1.08rem' }}>
                            {formatWon(summary.incomeSupplyTotal)}
                        </h3>
                    </div>

                    <div style={summaryCardStyle}>
                        <p style={{ margin: 0, color: '#64748b', fontWeight: 900, fontSize: '0.82rem' }}>
                            수입 VAT 합계
                        </p>
                        <h3 style={{ margin: '0.35rem 0 0', color: '#334155', fontSize: '1.08rem' }}>
                            {formatWon(summary.incomeVatTotal)}
                        </h3>
                    </div>

                    <div style={summaryCardStyle}>
                        <p style={{ margin: 0, color: '#64748b', fontWeight: 900, fontSize: '0.82rem' }}>
                            수입 순이익 합계
                        </p>
                        <h3 style={{ margin: '0.35rem 0 0', color: '#166534', fontSize: '1.08rem' }}>
                            {formatWon(summary.incomeNetProfitTotal)}
                        </h3>
                    </div>

                    <div style={summaryCardStyle}>
                        <p style={{ margin: 0, color: '#64748b', fontWeight: 900, fontSize: '0.82rem' }}>
                            비용 공급가액 합계
                        </p>
                        <h3 style={{ margin: '0.35rem 0 0', color: '#991b1b', fontSize: '1.08rem' }}>
                            {formatWon(summary.expenseSupplyTotal)}
                        </h3>
                    </div>

                    <div style={incomeSummaryCardStyle}>
                        <p style={{ margin: 0, color: '#64748b', fontWeight: 900, fontSize: '0.82rem' }}>
                            최종 이익
                        </p>
                        <h3 style={{ margin: '0.35rem 0 0', color: '#166534', fontSize: '1.08rem' }}>
                            {formatWon(summary.finalProfit)}
                        </h3>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <section style={expenseSectionStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                            <div>
                                <h3 style={{ margin: 0, color: '#9a3412', fontSize: '1.08rem' }}>
                                    🍑 비용 입력표
                                </h3>
                                <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                                    선택한 월의 지출 내역
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button type="button" onClick={downloadExpenseExcel} style={excelButtonStyle}>
                                    Excel로 출력하기
                                </button>

                                <button type="button" onClick={addExpenseRow} style={addButtonStyle}>
                                    + 비용 행 추가
                                </button>
                            </div>
                        </div>

                        <table style={tableStyle}>
                            <colgroup>
                                <col style={{ width: '4%' }} />
                                <col style={{ width: '13%' }} />
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '13%' }} />
                                <col style={{ width: '16%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '14%' }} />
                                <col style={{ width: '8%' }} />
                            </colgroup>

                            <thead>
                                <tr>
                                    <th style={thStyle}>번호</th>
                                    <th style={thStyle}>날짜</th>
                                    <th style={thStyle}>대</th>
                                    <th style={thStyle}>계정과목_소</th>
                                    <th style={thStyle}>거래내용</th>
                                    <th style={thStyle}>거래처</th>
                                    <th style={thStyle}>공급가액</th>
                                    <th style={thStyle}>처리방법</th>
                                    <th style={thStyle}>삭제</th>
                                </tr>
                            </thead>

                            <tbody>
                                {expenseRecords.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={9}
                                            style={{
                                                padding: '1.4rem',
                                                textAlign: 'center',
                                                color: '#94a3b8',
                                                fontWeight: 850,
                                                border: '1px solid #e2e8f0',
                                                background: '#ffffff',
                                            }}
                                        >
                                            선택한 월에 입력된 비용 내역이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    expenseRecords.map((record, index) => (
                                        <tr key={record.id}>
                                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 900 }}>
                                                {index + 1}
                                            </td>

                                            <td style={tdStyle}>
                                                <input
                                                    type="date"
                                                    value={record.date}
                                                    onChange={(e) => updateTextField(record.id, 'date', e.target.value)}
                                                    style={baseInputStyle}
                                                />
                                            </td>

                                            <td style={tdStyle}>
                                                <div style={{ ...readonlyCellTextStyle, color: '#9a3412' }}>비용</div>
                                            </td>

                                            <td style={tdStyle}>
                                                <select
                                                    value={record.minorCategory}
                                                    onChange={(e) => updateTextField(record.id, 'minorCategory', e.target.value)}
                                                    style={selectStyle}
                                                >
                                                    <option value="">선택</option>
                                                    {expenseMinorCategoryOptions.map((option) => (
                                                        <option key={option} value={option}>
                                                            {option}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>

                                            <td style={tdStyle}>
                                                <input
                                                    value={record.description}
                                                    onChange={(e) => updateTextField(record.id, 'description', e.target.value)}
                                                    style={baseInputStyle}
                                                />
                                            </td>

                                            <td style={tdStyle}>
                                                <input
                                                    value={record.partnerName}
                                                    onChange={(e) => updateTextField(record.id, 'partnerName', e.target.value)}
                                                    style={baseInputStyle}
                                                />
                                            </td>

                                            <td style={tdStyle}>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formatMoneyInput(record.supplyAmount)}
                                                    onChange={(e) => updateExpenseAmount(record.id, e.target.value)}
                                                    style={numberInputStyle}
                                                />
                                            </td>

                                            <td style={tdStyle}>
                                                <select
                                                    value={record.note}
                                                    onChange={(e) => updateTextField(record.id, 'note', e.target.value)}
                                                    style={selectStyle}
                                                >
                                                    <option value="">선택</option>
                                                    {noteOptions.map((option) => (
                                                        <option key={option} value={option}>
                                                            {option}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>

                                            <td style={tdStyle}>
                                                <button
                                                    type="button"
                                                    onClick={() => deleteRecord(record.id)}
                                                    style={deleteButtonStyle}
                                                >
                                                    삭제
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </section>

                    <section style={incomeSectionStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                            <div>
                                <h3 style={{ margin: 0, color: '#166534', fontSize: '1.08rem' }}>
                                    🌿 수입 입력표
                                </h3>
                                <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                                    선택한 월의 수입 내역
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button type="button" onClick={downloadIncomeExcel} style={excelButtonStyle}>
                                    Excel로 출력하기
                                </button>

                                <button type="button" onClick={addIncomeRow} style={addButtonStyle}>
                                    + 수입 행 추가
                                </button>
                            </div>
                        </div>

                        <table style={tableStyle}>
                            <colgroup>
                                <col style={{ width: '4%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '7%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '14%' }} />
                                <col style={{ width: '11%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '9%' }} />
                                <col style={{ width: '9%' }} />
                                <col style={{ width: '6%' }} />
                            </colgroup>

                            <thead>
                                <tr>
                                    <th style={thStyle}>번호</th>
                                    <th style={thStyle}>날짜</th>
                                    <th style={thStyle}>대</th>
                                    <th style={thStyle}>계정과목_소</th>
                                    <th style={thStyle}>거래내용</th>
                                    <th style={thStyle}>거래처</th>
                                    <th style={thStyle}>공급가액</th>
                                    <th style={thStyle}>VAT</th>
                                    <th style={thStyle}>순이익</th>
                                    <th style={thStyle}>처리방법</th>
                                    <th style={thStyle}>삭제</th>
                                </tr>
                            </thead>

                            <tbody>
                                {incomeRecords.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={11}
                                            style={{
                                                padding: '1.4rem',
                                                textAlign: 'center',
                                                color: '#94a3b8',
                                                fontWeight: 850,
                                                border: '1px solid #e2e8f0',
                                                background: '#ffffff',
                                            }}
                                        >
                                            선택한 월에 입력된 수입 내역이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    incomeRecords.map((record, index) => (
                                        <tr key={record.id}>
                                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 900 }}>
                                                {index + 1}
                                            </td>

                                            <td style={tdStyle}>
                                                <input
                                                    type="date"
                                                    value={record.date}
                                                    onChange={(e) => updateTextField(record.id, 'date', e.target.value)}
                                                    style={baseInputStyle}
                                                />
                                            </td>

                                            <td style={tdStyle}>
                                                <div style={{ ...readonlyCellTextStyle, color: '#166534' }}>수입</div>
                                            </td>

                                            <td style={tdStyle}>
                                                <select
                                                    value={record.minorCategory}
                                                    onChange={(e) => updateTextField(record.id, 'minorCategory', e.target.value)}
                                                    style={selectStyle}
                                                >
                                                    <option value="">선택</option>
                                                    {incomeMinorCategoryOptions.map((option) => (
                                                        <option key={option} value={option}>
                                                            {option}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>

                                            <td style={tdStyle}>
                                                <input
                                                    value={record.description}
                                                    onChange={(e) => updateTextField(record.id, 'description', e.target.value)}
                                                    style={baseInputStyle}
                                                />
                                            </td>

                                            <td style={tdStyle}>
                                                <input
                                                    value={record.partnerName}
                                                    onChange={(e) => updateTextField(record.id, 'partnerName', e.target.value)}
                                                    style={baseInputStyle}
                                                />
                                            </td>

                                            <td style={tdStyle}>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formatMoneyInput(record.supplyAmount)}
                                                    onChange={(e) =>
                                                        updateIncomeNumber(record.id, 'supplyAmount', e.target.value)
                                                    }
                                                    style={numberInputStyle}
                                                />
                                            </td>

                                            <td style={tdStyle}>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formatMoneyInput(record.vat)}
                                                    onChange={(e) => updateIncomeNumber(record.id, 'vat', e.target.value)}
                                                    style={numberInputStyle}
                                                />
                                            </td>

                                            <td style={tdStyle}>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formatMoneyInput(record.netProfit)}
                                                    readOnly
                                                    style={{
                                                        ...numberInputStyle,
                                                        fontWeight: 900,
                                                        background: '#f8fafc',
                                                    }}
                                                />
                                            </td>

                                            <td style={tdStyle}>
                                                <select
                                                    value={record.note}
                                                    onChange={(e) => updateTextField(record.id, 'note', e.target.value)}
                                                    style={selectStyle}
                                                >
                                                    <option value="">선택</option>
                                                    {noteOptions.map((option) => (
                                                        <option key={option} value={option}>
                                                            {option}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>

                                            <td style={tdStyle}>
                                                <button
                                                    type="button"
                                                    onClick={() => deleteRecord(record.id)}
                                                    style={deleteButtonStyle}
                                                >
                                                    삭제
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </section>
                </div>
            </div>

            <div
                style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    margin: '0.2rem 0 1.4rem',
                }}
            >
                <button
                    type="button"
                    onClick={handleSaveToFirebase}
                    disabled={isSaving}
                    style={{
                        ...saveButtonStyle,
                        minWidth: '180px',
                        height: '48px',
                        opacity: isSaving ? 0.65 : 1,
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                    }}
                >
                    {isSaving ? '저장 중...' : '저장하기'}
                </button>
            </div>
            <div
                className="card"
                style={{
                    borderRadius: '28px',
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    boxShadow: '0 14px 32px rgba(15, 23, 42, 0.06)',
                    padding: '1.25rem',
                    marginBottom: '1.4rem',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginBottom: '1rem',
                    }}
                >
                    <div>
                        <h3 style={{ margin: 0, color: '#334155', fontSize: '1.15rem' }}>
                            기간별 수익 통계
                        </h3>
                        <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.9rem', fontWeight: 700 }}>
                            시작 월과 종료 월을 선택한 뒤 검색하면 해당 기간의 통계를 볼 수 있습니다.
                        </p>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            gap: '0.6rem',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            padding: '0.75rem',
                            borderRadius: '18px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                        }}
                    >
                        <label
                            style={{
                                color: '#475569',
                                fontSize: '0.88rem',
                                fontWeight: 950,
                            }}
                        >
                            기간
                        </label>

                        <input
                            type="month"
                            value={statsStartMonth}
                            onChange={(e) => setStatsStartMonth(e.target.value)}
                            style={{
                                width: '145px',
                                height: '38px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '999px',
                                padding: '0 0.8rem',
                                color: '#334155',
                                fontWeight: 850,
                                background: '#ffffff',
                                outline: 'none',
                            }}
                        />

                        <span style={{ color: '#64748b', fontWeight: 900 }}>~</span>

                        <input
                            type="month"
                            value={statsEndMonth}
                            onChange={(e) => setStatsEndMonth(e.target.value)}
                            style={{
                                width: '145px',
                                height: '38px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '999px',
                                padding: '0 0.8rem',
                                color: '#334155',
                                fontWeight: 850,
                                background: '#ffffff',
                                outline: 'none',
                            }}
                        />

                        <button
                            type="button"
                            onClick={handleStatsSearch}
                            style={{
                                border: '1px solid #bfdbfe',
                                borderRadius: '999px',
                                padding: '0.58rem 1rem',
                                background: 'linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%)',
                                color: '#1d4ed8',
                                fontWeight: 950,
                                cursor: 'pointer',
                                boxShadow: '0 6px 14px rgba(37, 99, 235, 0.08)',
                            }}
                        >
                            검색
                        </button>
                    </div>
                </div>

                {statsMessage && (
                    <p style={{ margin: '0 0 1rem', color: '#be123c', fontWeight: 850 }}>
                        {statsMessage}
                    </p>
                )}

                {periodStats ? (
                    <>
                        <div
                            style={{
                                marginBottom: '0.9rem',
                                color: '#64748b',
                                fontSize: '0.88rem',
                                fontWeight: 800,
                            }}
                        >
                            검색 기간: {appliedStatsPeriod?.startMonth} ~ {appliedStatsPeriod?.endMonth}
                            {' · '}
                            입력 내역 {periodStats.totalCount}건
                        </div>
                        {periodStats.monthlyStats.length > 0 && (

                            <div

                                style={{

                                    marginTop: '1.1rem',

                                    padding: '1rem',

                                    borderRadius: '22px',

                                    background: '#ffffff',

                                    border: '1px solid #e2e8f0',

                                    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.045)',

                                }}

                            >

                                <div

                                    style={{

                                        display: 'flex',

                                        justifyContent: 'space-between',

                                        gap: '1rem',

                                        alignItems: 'center',

                                        flexWrap: 'wrap',

                                        marginBottom: '0.9rem',

                                    }}

                                >

                                    <div>

                                        <h4 style={{ margin: 0, color: '#334155', fontSize: '1rem', fontWeight: 950 }}>

                                            월별 수익 그래프

                                        </h4>

                                        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.82rem', fontWeight: 750 }}>

                                            X축은 월, Y축은 금액입니다.

                                        </p>

                                    </div>



                                    <div

                                        style={{

                                            display: 'flex',

                                            gap: '0.75rem',

                                            alignItems: 'center',

                                            flexWrap: 'wrap',

                                            color: '#64748b',

                                            fontSize: '0.78rem',

                                            fontWeight: 850,

                                        }}

                                    >

                                        <span style={{ color: '#166534' }}>● 순이익</span>

                                        <span style={{ color: '#991b1b' }}>● 비용</span>

                                        <span style={{ color: '#2563eb' }}>● 최종 이익</span>

                                    </div>

                                </div>



                                {(() => {

                                    const chartWidth = 900;

                                    const chartHeight = 320;

                                    const paddingLeft = 78;

                                    const paddingRight = 28;

                                    const paddingTop = 28;

                                    const paddingBottom = 58;



                                    const values = periodStats.monthlyStats.flatMap((item) => [

                                        item.incomeNetProfitTotal,

                                        item.expenseSupplyTotal,

                                        item.finalProfit,

                                    ]);



                                    const maxValue = Math.max(...values, 0);

                                    const minValue = Math.min(...values, 0);

                                    const valueRange = maxValue - minValue || 1;



                                    const getX = (index: number) => {

                                        if (periodStats.monthlyStats.length === 1) {

                                            return paddingLeft + (chartWidth - paddingLeft - paddingRight) / 2;

                                        }



                                        return (

                                            paddingLeft +

                                            (index * (chartWidth - paddingLeft - paddingRight)) /

                                            (periodStats.monthlyStats.length - 1)

                                        );

                                    };



                                    const getY = (value: number) => {

                                        return (

                                            paddingTop +

                                            ((maxValue - value) * (chartHeight - paddingTop - paddingBottom)) /

                                            valueRange

                                        );

                                    };



                                    const makePolylinePoints = (

                                        key: 'incomeNetProfitTotal' | 'expenseSupplyTotal' | 'finalProfit'

                                    ) => {

                                        return periodStats.monthlyStats

                                            .map((item, index) => `${getX(index)},${getY(item[key])}`)

                                            .join(' ');

                                    };



                                    const zeroY = getY(0);



                                    return (

                                        <svg

                                            viewBox={`0 0 ${chartWidth} ${chartHeight}`}

                                            style={{

                                                width: '100%',

                                                height: 'auto',

                                                display: 'block',

                                                overflow: 'visible',

                                            }}

                                        >

                                            <line

                                                x1={paddingLeft}

                                                y1={paddingTop}

                                                x2={paddingLeft}

                                                y2={chartHeight - paddingBottom}

                                                stroke="#cbd5e1"

                                                strokeWidth="1.5"

                                            />



                                            <line

                                                x1={paddingLeft}

                                                y1={zeroY}

                                                x2={chartWidth - paddingRight}

                                                y2={zeroY}

                                                stroke="#94a3b8"

                                                strokeWidth="1.2"

                                                strokeDasharray="4 4"

                                            />



                                            <text

                                                x={paddingLeft - 12}

                                                y={paddingTop + 4}

                                                textAnchor="end"

                                                fontSize="12"

                                                fontWeight="800"

                                                fill="#64748b"

                                            >

                                                {formatWon(maxValue)}

                                            </text>



                                            <text

                                                x={paddingLeft - 12}

                                                y={zeroY + 4}

                                                textAnchor="end"

                                                fontSize="12"

                                                fontWeight="800"

                                                fill="#64748b"

                                            >

                                                0원

                                            </text>



                                            {minValue < 0 && (

                                                <text

                                                    x={paddingLeft - 12}

                                                    y={chartHeight - paddingBottom + 4}

                                                    textAnchor="end"

                                                    fontSize="12"

                                                    fontWeight="800"

                                                    fill="#64748b"

                                                >

                                                    {formatWon(minValue)}

                                                </text>

                                            )}






                                            <polyline
                                                points={makePolylinePoints('incomeNetProfitTotal')}
                                                fill="none"
                                                stroke="#166534"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />

                                            <polyline
                                                points={makePolylinePoints('expenseSupplyTotal')}
                                                fill="none"
                                                stroke="#991b1b"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />

                                            <polyline
                                                points={makePolylinePoints('finalProfit')}
                                                fill="none"
                                                stroke="#2563eb"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />

                                            {periodStats.monthlyStats.map((item, index) => {
                                                const x = getX(index);

                                                return (
                                                    <g key={item.month}>
                                                        <circle
                                                            cx={x}
                                                            cy={getY(item.incomeNetProfitTotal)}
                                                            r="4"
                                                            fill="#166534"
                                                        />
                                                        <circle
                                                            cx={x}
                                                            cy={getY(item.expenseSupplyTotal)}
                                                            r="4"
                                                            fill="#991b1b"
                                                        />
                                                        <circle
                                                            cx={x}
                                                            cy={getY(item.finalProfit)}
                                                            r="4"
                                                            fill="#2563eb"
                                                        />

                                                        <line
                                                            x1={x}
                                                            y1={chartHeight - paddingBottom}
                                                            x2={x}
                                                            y2={chartHeight - paddingBottom + 6}
                                                            stroke="#cbd5e1"
                                                        />

                                                        <text
                                                            x={x}
                                                            y={chartHeight - paddingBottom + 24}
                                                            textAnchor="middle"
                                                            fontSize="12"
                                                            fontWeight="800"
                                                            fill="#64748b"
                                                        >
                                                            {item.month.slice(5)}월
                                                        </text>
                                                    </g>
                                                );
                                            })}
                                        </svg>
                                    );
                                })()}
                            </div>
                        )}
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: '0.85rem',
                                marginTop: '1rem',
                            }}
                        >

                            <div style={incomeSummaryCardStyle}>
                                <p style={{ margin: 0, color: '#64748b', fontWeight: 900, fontSize: '0.82rem' }}>
                                    순이익 합계
                                </p>
                                <h3 style={{ margin: '0.35rem 0 0', color: '#166534', fontSize: '1.18rem' }}>
                                    {formatWon(periodStats.incomeNetProfitTotal)}
                                </h3>
                                <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: '0.78rem', fontWeight: 800 }}>
                                    수입 내역 {periodStats.incomeCount}건
                                </p>
                            </div>

                            <div style={expenseSummaryCardStyle}>
                                <p style={{ margin: 0, color: '#64748b', fontWeight: 900, fontSize: '0.82rem' }}>
                                    비용 합계
                                </p>
                                <h3 style={{ margin: '0.35rem 0 0', color: '#991b1b', fontSize: '1.18rem' }}>
                                    {formatWon(periodStats.expenseSupplyTotal)}
                                </h3>
                                <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: '0.78rem', fontWeight: 800 }}>
                                    비용 내역 {periodStats.expenseCount}건
                                </p>
                            </div>

                            <div style={incomeSummaryCardStyle}>
                                <p style={{ margin: 0, color: '#64748b', fontWeight: 900, fontSize: '0.82rem' }}>
                                    최종 이익 합계
                                </p>
                                <h3 style={{ margin: '0.35rem 0 0', color: '#166534', fontSize: '1.18rem' }}>
                                    {formatWon(periodStats.finalProfit)}
                                </h3>
                                <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: '0.78rem', fontWeight: 800 }}>
                                    순이익 - 비용
                                </p>
                            </div>
                        </div>


                    </>
                ) : (
                    <div
                        style={{
                            padding: '1.2rem',
                            borderRadius: '20px',
                            background: '#f8fafc',
                            border: '1px dashed #cbd5e1',
                            color: '#64748b',
                            fontWeight: 850,
                            textAlign: 'center',
                        }}
                    >
                        기간을 선택하고 검색 버튼을 누르면 통계가 표시됩니다.
                    </div>
                )}
            </div>


            <div
                className="card"
                style={{
                    borderRadius: '28px',
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    boxShadow: '0 14px 32px rgba(15, 23, 42, 0.06)',
                    padding: '1.25rem',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                    }}
                >



                    <div>
                        <h3 style={{ margin: 0, color: '#334155', fontSize: '1.15rem' }}>
                            비용 및 내역 보기
                        </h3>
                        <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.9rem', fontWeight: 700 }}>
                            저장 버튼을 누르면 현재 월의 내역이 JPG 이미지로 저장됩니다.
                        </p>
                    </div>
                </div>


                <div
                    style={{
                        marginTop: '1rem',
                        display: 'flex',
                        gap: '0.6rem',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        padding: '0.85rem',
                        borderRadius: '18px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                    }}
                >
                    <label
                        htmlFor="gallery-search-month"
                        style={{
                            color: '#475569',
                            fontSize: '0.9rem',
                            fontWeight: 950,
                        }}
                    >
                        월별 검색
                    </label>

                    <input
                        id="gallery-search-month"
                        type="month"
                        value={gallerySearchMonth}
                        onChange={(e) => setGallerySearchMonth(e.target.value)}
                        style={{
                            width: '150px',
                            minWidth: '150px',
                            height: '38px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '999px',
                            padding: '0 0.9rem',
                            color: '#334155',
                            fontWeight: 850,
                            background: '#ffffff',
                            outline: 'none',
                        }}
                    />

                    <button
                        type="button"
                        onClick={() => setAppliedGallerySearchMonth(gallerySearchMonth)}
                        style={{
                            border: '1px solid #bfdbfe',
                            borderRadius: '999px',
                            padding: '0.58rem 1rem',
                            background: 'linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%)',
                            color: '#1d4ed8',
                            fontWeight: 950,
                            cursor: 'pointer',
                            boxShadow: '0 6px 14px rgba(37, 99, 235, 0.08)',
                        }}
                    >
                        검색
                    </button>

                    {appliedGallerySearchMonth && (
                        <button
                            type="button"
                            onClick={() => {
                                setGallerySearchMonth('');
                                setAppliedGallerySearchMonth('');
                            }}
                            style={gallerySearchButtonStyle}
                        >
                            전체 보기
                        </button>
                    )}

                    <span
                        style={{
                            color: '#64748b',
                            fontSize: '0.82rem',
                            fontWeight: 800,
                        }}
                    >
                        {appliedGallerySearchMonth
                            ? `${appliedGallerySearchMonth} 저장 이미지 ${filteredSavedReports.length}개`
                            : `전체 저장 이미지 ${savedReports.length}개`}
                    </span>
                </div>

            </div>

            {saveMessage && (
                <p style={{ margin: '0.9rem 0 0', color: '#334155', fontWeight: 850 }}>
                    {saveMessage}
                </p>
            )}

            {filteredSavedReports.length > 0 ? (
                <div
                    style={{
                        marginTop: '1rem',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 260px))',
                        gap: '1rem',
                        justifyContent: 'flex-start',
                    }}
                >


                    {filteredSavedReports.map((report) => (
                        <div
                            key={report.id}
                            style={{
                                border: '1px solid #e2e8f0',
                                borderRadius: '20px',
                                background: '#ffffff',
                                padding: '0.8rem',
                                boxShadow: '0 8px 18px rgba(15, 23, 42, 0.05)',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: '0.5rem',
                                    alignItems: 'center',
                                    marginBottom: '0.65rem',
                                }}
                            >
                                <div>
                                    <div
                                        style={{
                                            color: '#334155',
                                            fontWeight: 950,
                                            fontSize: '0.92rem',
                                        }}
                                    >
                                        {report.month}
                                    </div>

                                    <div
                                        style={{
                                            color: '#64748b',
                                            fontWeight: 700,
                                            fontSize: '0.78rem',
                                            marginTop: '0.15rem',
                                        }}
                                    >
                                        {new Date(report.createdAtMs).toLocaleString('ko-KR')}
                                    </div>
                                </div>

                                <a
                                    href={report.imageUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                        color: '#6d28d9',
                                        fontWeight: 900,
                                        fontSize: '0.8rem',
                                        textDecoration: 'none',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    크게 보기
                                </a>
                            </div>

                            <a href={report.imageUrl} target="_blank" rel="noreferrer">
                                <img
                                    src={report.imageUrl}
                                    alt={`${report.month} 수입 및 비용 내역`}
                                    style={{
                                        width: '100%',
                                        height: '180px',
                                        objectFit: 'contain',
                                        objectPosition: 'top',
                                        borderRadius: '14px',
                                        border: '1px solid #e2e8f0',
                                        background: '#f8fafc',
                                        display: 'block',
                                    }}
                                />
                            </a>
                        </div>
                    ))}
                </div>
            ) : (
                <div
                    style={{
                        marginTop: '1rem',
                        padding: '1.5rem',
                        borderRadius: '20px',
                        background: '#ffffff',
                        border: '1px dashed #cbd5e1',
                        color: '#64748b',
                        fontWeight: 850,
                        textAlign: 'center',
                    }}
                >
                    {appliedGallerySearchMonth
                        ? '해당 월에 저장된 JPG 내역이 없습니다.'
                        : '아직 저장된 JPG 내역이 없습니다.'}
                </div>
            )}
        </div>
    );
};