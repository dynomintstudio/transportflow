/**
 * Numeric range of any kind of value
 */
export class Range {

	/**
	 * Lowest value in range
	 */
	from: number;

	/**
	 * Highest value in range
	 */
	to: number;

	/**
	 * Construct new Range instance
	 * @param from from value
	 * @param to to value
	 */
	constructor(from: number, to: number) {
		this.from = from;
		this.to = to;
	}

	/**
	 * Checks whether given value is in range
	 * @param value value
	 */
	in(value: number): Boolean {
		return value >= this.from && value <= this.to;
	}

	/**
	 * Map certain value [0, 1] to range
	 * @param value value
	 * @param range range
	 */
	static map(value: number, range: Range): number {
		return value * (range.to - range.from) + range.from;
	}

}