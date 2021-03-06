import {Shape} from './Shape'
import {Position} from './Position'
import {Rectangle} from './Rectangle'

import * as _ from 'lodash'

/**
 * Library wrapper of a jagged 2d array acting as matrix data structure
 */
export class Matrix<T> {

	/**
	 * Matrix shape
	 */
	shape: Shape

	/**
	 * Internal value. Jagged 2d array itself
	 */
	value: T[][]

	/**
	 * Total number of elements (shape area)
	 */
	length: number

	/**
	 * Constructs new Matrix instance.
	 * When both params `null` then empty matrix is constructed
	 * @param shape matrix shape. When `null` then shape is automatically calculated from given @param value
	 * @param value matrix internal value. When `null` then matrix automatically filled with nulls by given @param shape
	 * @param fill default value for matrix initialization, if @param value was not set
	 */
	constructor(shape: Shape = null, value: T[][] = null, fill: () => T = () => null) {
		this.shape = shape
		this.value = value

		if (!shape && !value) throw new TypeError('invalid parameters')

		if (!shape) {
			this.shape = new Shape(value[0] ? value[0].length : 0, value.length)
		}
		if (!value || value.length !== this.shape.height) {
			this.value = Array.from({length: this.shape.height}, () => new Array(this.shape.width))
			this.value.forEach((__, i) => {
				this.value[i] = Array.from({length: this.shape.width}, () => fill())
			})
		}
		this.length = this.shape.area()
	}

	/**
	 * Returns element from specified position
	 * @param position element's position
	 */
	at(position: Position): T {
		if (!this.has(position)) throw new Error(`invalid position ${position}`)

		return this.value[position.y][position.x]
	}

	/**
	 * Sets element in specified position
	 * @param position position to be set
	 * @param value element value
	 */
	set(position: Position, value: T) {
		if (!this.has(position)) throw new Error(`invalid position ${position}`)

		this.value[position.y][position.x] = value
	}

	has(position: Position): Boolean {
		return !(position.x < 0 || position.x >= this.shape.width ||
			position.y < 0 || position.y >= this.shape.height)
	}

	insert(position: Position, matrix: Matrix<T>) {
		if (position.x < 0 || position.x + matrix.shape.width > this.shape.width ||
			position.y < 0 || position.y + matrix.shape.height > this.shape.height)
			throw new Error('insertion out of bounds')

		_.range(position.y, position.y + matrix.shape.height).forEach(i => {
			_.range(position.x, position.x + matrix.shape.width).forEach(j => {
				this.set(
					new Position(j, i),
					matrix.at(
						new Position(j - position.x, i - position.y)
					))
			})
		})
	}

	/**
	 * Return submatrix of specified @param rectangle
	 * TODO: cyclic parameter
	 * @param rectangle submatrix position and shape
	 * @param outFill if @param rectangle goes out of matrix's bound then such elements filled with it
	 */
	of(rectangle: Rectangle, outFill: T = null): Matrix<T> {
		const result = new Matrix<T>(rectangle.shape)

		for (let i = rectangle.topLeft.y; i < rectangle.bottomRight.y; i++) {
			for (let j = rectangle.topLeft.x; j < rectangle.bottomRight.x; j++) {
				if (this.value[i] && this.value[i][j]) {
					result.value[i - rectangle.topLeft.y][j - rectangle.topLeft.x] = this.value[i][j]
				} else {
					result.value[i - rectangle.topLeft.y][j - rectangle.topLeft.x] = outFill
				}
			}
		}

		return result
	}

	/**
	 * Maps whole matrix by specified function
	 * @param func mapping function
	 * @return mapped matrix
	 */
	map<D>(func: (t: T, position: Position) => D): Matrix<D> {
		return new Matrix<D>(
			this.shape,
			this.value
				.map((row, i) =>
					row.map((e, j) => func(e, new Position(j, i)))
				)
		)
	}

	/**
	 * Run function on every matrix element.
	 * Traversing is from first column to last column, from first row to last row
	 * @param func
	 */
	forEach(func: (e: T, position: Position) => void): void {
		_.range(this.shape.height).forEach(i => {
			_.range(this.shape.width).forEach(j => {
				func(this.value[i][j], new Position(j, i))
			})
		})
	}

	/**
	 * Convert matrix into flatted array by columns
	 */
	flatMap(): T[] {
		return this.value.flatMap(t => t)
	}

	/**
	 * Rotate matrix clockwise
	 * Example:
	 * <pre>
	 * [0 1] -> [2 0]
	 * [2 3]    [3 1]
	 * </pre>
	 */
	rotateClockwise(): Matrix<T> {
		const result = new Matrix<T>(this.shape)

		const n = this.value[0].length

		const center = new Position(Math.floor(n / 2), Math.floor(n / 2))
		result.set(center, this.at(center))

		_.range(n / 2).forEach(i => {
			_.range(i, n - i - 1).forEach(j => {
				result.value[i][j] = this.value[n - 1 - j][i]
				result.value[n - 1 - j][i] = this.value[n - 1 - i][n - 1 - j]
				result.value[n - 1 - i][n - 1 - j] = this.value[j][n - 1 - i]
				result.value[j][n - 1 - i] = this.value[i][j]
			})
		})

		return result
	}

	/**
	 * Get matrix of neighbours of size `[2*radius, 2*radius]`
	 * @param position
	 * @param radius
	 */
	neighbourSubmatrix(position: Position, radius: number): Matrix<T> {
		return this.of(
			Rectangle.rectangleByOnePoint(
				position.map(c => c - radius),
				Shape.square(2 * radius + 1)
			),
			null
		)
	}

	/**
	 * String representation
	 */
	toString(): string {
		let result = ''

		for (const col of this.value) {
			result += `[${col.join(', ')}]\n`
		}

		return result
	}

}
