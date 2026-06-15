import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from '../firebase';

export interface SaveSpeechProgressReportInput {
    studentName: string;
    startDate: string;
    endDate: string;
    imageDataUrl: string;
    differenceText: string;
    improvedText: string;
    repeatedProblemText: string;
    followUpText: string;
}

export interface SavedSpeechProgressReport {
    id: string;
    studentName: string;
    startDate: string;
    endDate: string;
    imageUrl: string;
    createdAt: unknown;
    createdAtMs: number;
    differenceText: string;
    improvedText: string;
    repeatedProblemText: string;
    followUpText: string;
}

const sanitizeFileName = (value: string) => {
    return (
        value
            .trim()
            .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, '_')
            .replace(/\s+/g, '_') || 'student'
    );
};

export const saveSpeechProgressReportToFirebase = async (
    input: SaveSpeechProgressReportInput
): Promise<SavedSpeechProgressReport> => {
    if (!isFirebaseConfigured || !db || !storage) {
        throw new Error('Firebase is not configured.');
    }

    const createdAtMs = Date.now();
    const safeStudentName = sanitizeFileName(input.studentName);

    const imagePath = `speechProgressImages/${safeStudentName}_${input.startDate}_${input.endDate}_${createdAtMs}.jpg`;

    const imageRef = ref(storage, imagePath);

    await uploadString(imageRef, input.imageDataUrl, 'data_url', {
        contentType: 'image/jpeg',
    });

    const imageUrl = await getDownloadURL(imageRef);

    const reportData = {
        studentName: input.studentName,
        startDate: input.startDate,
        endDate: input.endDate,
        imageUrl,
        storagePath: imagePath,
        createdAt: serverTimestamp(),
        createdAtMs,
        differenceText: input.differenceText,
        improvedText: input.improvedText,
        repeatedProblemText: input.repeatedProblemText,
        followUpText: input.followUpText,
    };

    const docRef = await addDoc(collection(db, 'speechProgressReports'), reportData);

    return {
        id: docRef.id,
        ...reportData,
    };
};

export const getSpeechProgressReportsFromFirebase = async (): Promise<SavedSpeechProgressReport[]> => {
    if (!isFirebaseConfigured || !db) {
        return [];
    }

    const q = query(collection(db, 'speechProgressReports'), orderBy('createdAtMs', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((documentSnapshot) => {
        const data = documentSnapshot.data();

        return {
            id: documentSnapshot.id,
            studentName: String(data.studentName ?? ''),
            startDate: String(data.startDate ?? ''),
            endDate: String(data.endDate ?? ''),
            imageUrl: String(data.imageUrl ?? ''),
            createdAt: data.createdAt ?? null,
            createdAtMs: Number(data.createdAtMs ?? 0),
            differenceText: String(data.differenceText ?? ''),
            improvedText: String(data.improvedText ?? ''),
            repeatedProblemText: String(data.repeatedProblemText ?? ''),
            followUpText: String(data.followUpText ?? ''),
        };
    });
};