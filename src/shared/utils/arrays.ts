// Role of groupBy: 배열을 특정 키를 기준으로 그룹화하는 함수입니다. 예를 들어, 객체 배열에서 특정 속성 값을 기준으로 객체들을 그룹화할 때 사용할 수 있습니다.
export function groupBy<TItem, TKey extends string>(
  items: TItem[],
  getKey: (item: TItem) => TKey,
): Record<TKey, TItem[]> {
  const result = {} as Record<TKey, TItem[]>;

  for (const item of items) {
    const key = getKey(item);
    result[key] ??= [];
    result[key].push(item);
  }

  return result
}
