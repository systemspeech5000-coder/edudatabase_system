import {
    addDoc,
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';

import { db, storage } from '../firebase';

export type FinanceRecordType = 'income' | 'expense';

export interface BaseFinanceRecord {
    id: string;
    type: FinanceRecordType;
    date: string;
    majorCategory: string;
    minorCategory: string;
    description: string;
    partnerName: string;
    supplyAmount: number;
    note: string;
}

export interface IncomeRecord extends BaseFinanceRecord {
    type: 'income';
    vat: number;
    netProfit: number;
}

export interface ExpenseRecord extends BaseFinanceRecord {
    type: 'expense';
}

export type FinanceRecord = IncomeRecord | ExpenseRecord;

export interface FinanceSummary {
    incomeSupplyTotal: number;
    incomeVatTotal: number;
    incomeNetProfitTotal: number;
    expenseSupplyTotal: number;
    finalProfit: number;
}

export interface SavedFinanceReport {
    id: string;
    month: string;
    imageUrl: string;
    imagePath: string;
    records: FinanceRecord[];
    summary: FinanceSummary;
    createdAtMs: number;
}

interface SaveFinanceReportParams {
    month: string;
    records: FinanceRecord[];
    summary: FinanceSummary;
    imageDataUrl: string;
}

export const saveFinanceReportToFirebase = async ({
    month,
    records,
    summary,
    imageDataUrl,
}: SaveFinanceReportParams): Promise<SavedFinanceReport> => {
    if (!db || !storage) {
        throw new Error('Firebase 설정이 완료되지 않았습니다.');
    }

    const createdAtMs = Date.now();
    const imagePath = `finance-reports/${month}/finance-report-${createdAtMs}.jpg`;
    const imageRef = ref(storage, imagePath);

    await uploadString(imageRef, imageDataUrl, 'data_url', {
        contentType: 'image/jpeg',
    });

    const imageUrl = await getDownloadURL(imageRef);

    const reportData = {
        month,
        imageUrl,
        imagePath,
        records,
        summary,
        createdAtMs,
        createdAt: serverTimestamp(),
    };

    const imageDocRef = await addDoc(collection(db, 'financeReportImages'), reportData);

    await setDoc(
        doc(db, 'financeReports', month),
        {
            ...reportData,
            latestImageId: imageDocRef.id,
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    );

    return {
        id: imageDocRef.id,
        month,
        imageUrl,
        imagePath,
        records,
        summary,
        createdAtMs,
    };
};

export const getFinanceReportGalleryFromFirebase = async (): Promise<SavedFinanceReport[]> => {
    if (!db) {
        return [];
    }

    const galleryQuery = query(
        collection(db, 'financeReportImages'),
        orderBy('createdAtMs', 'desc')
    );

    const snapshot = await getDocs(galleryQuery);

    return snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();

        return {
            id: docSnapshot.id,
            month: data.month,
            imageUrl: data.imageUrl,
            imagePath: data.imagePath,
            records: data.records ?? [],
            summary: data.summary,
            createdAtMs: data.createdAtMs ?? 0,
        } as SavedFinanceReport;
    });
};