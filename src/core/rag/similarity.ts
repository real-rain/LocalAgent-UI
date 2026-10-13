/**
 * 计算两个向量的余弦相似度。
 *
 * @param vecA 第一个向量。
 * @param vecB 第二个向量。
 * @returns 相似度数值；向量维数不一致或模长为零时返回 0。
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    for (let index = 0; index < vecA.length; index += 1) {
        const valueA = vecA[index]!;
        const valueB = vecB[index]!;
        dotProduct += valueA * valueB;
        magnitudeA += valueA * valueA;
        magnitudeB += valueB * valueB;
    }
    const denominator = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}
