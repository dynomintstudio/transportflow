import {Injectable} from '@angular/core'
import {CameraService} from './camera.service'
import {Camera} from '../model/Camera'
import {Position} from '../../common/model/Position'
import {WorldService} from '../../game-logic/service/world.service'
import {SpriteService} from './sprite.service'
import {first, throttleTime} from 'rxjs/operators'
import {World} from '../../game-logic/model/World'

import {Tile} from '../../game-logic/model/Tile'
import {Rectangle} from '../../common/model/Rectangle'
import {Shape} from '../../common/model/Shape'
import {Matrix} from '../../common/model/Matrix'
import {SingleCanvas} from '../../common/model/canvas/SingleCanvas'
import {ChunkedCanvas} from '../../common/model/canvas/ChunkedCanvas'
import {createCanvas} from '../../common/model/canvas/Canvas'
import {CameraConfig} from '../config/CameraConfig'
import {Range} from '../../common/model/Range'
import {Log} from '../../common/model/Log'
import * as _ from 'lodash'
import {InteractionService} from '../../input/service/interaction.service'
import {RenderProfileService} from './render-profile.service'
import {ConfigService} from '../../common/service/config.service'
import {untilNewFrom} from '../../common/operator/until-new-from.operator'
import {SpriteRenderService} from './sprite-render.service'

/**
 * Responsible for rendering canvases and updating map
 */
@Injectable({
	providedIn: 'root'
})
export class RenderService {

	log: Log = new Log(this)

	/**
	 * Off-screen world map
	 */
	map: ChunkedCanvas

	/**
	 * Off-screen world minimap
	 */
	minimap: SingleCanvas

	/**
	 * World canvas layer
	 */
	worldCanvas: SingleCanvas

	/**
	 * Interaction canvas layer
	 */
	interactionCanvas: SingleCanvas

	constructor(
		private cameraService: CameraService,
		private worldService: WorldService,
		private spriteService: SpriteService,
		private spriteRenderService: SpriteRenderService,
		private interactionService: InteractionService,
		private renderProfileService: RenderProfileService,
		private configService: ConfigService
	) {
		this.loadSprites(() => {
			this.initMap(() => {
				this.updateChunks(() => setTimeout(() => this.cameraService.camera.update(), 0))
				this.updateWorldLayer()
				this.updateInteractionLayer()
			})
		})
	}

	/**
	 * Initialize canvas layers
	 * @param worldCanvas
	 * @param interactionCanvas
	 * @param canvasContainer
	 */
	initView(worldCanvas: HTMLCanvasElement, interactionCanvas: HTMLCanvasElement, canvasContainer: HTMLElement): void {
		this.log.debug('initialize render view')
		this.worldCanvas = new SingleCanvas(worldCanvas)
		this.interactionCanvas = new SingleCanvas(interactionCanvas, true)

		window.addEventListener('resize', () =>
			this.resizeCanvas(new Shape(canvasContainer.offsetWidth, canvasContainer.offsetHeight))
		)
		window.dispatchEvent(new Event('resize'))
	}

	/**
	 * Load and cache sprites
	 * @param loaded callback of successful load
	 */
	private loadSprites(loaded?: () => void) {
		this.log.debug('load sprites')
		const startLoadSprites = new Date()
		this.spriteService.loadSprites(() => loaded?.())
		this.log.debug(`loaded sprites in ${(new Date().getTime() - startLoadSprites.getTime())}ms`)
	}

	/**
	 * Initialization of map, minimap and initial camera set
	 */
	private initMap(complete?: () => void): void {
		this.log.debug('initialize render maps')
		this.worldService.world.observable
			.pipe(first())
			.subscribe((world: World) => {
				this.configService.renderConfig.observable
					.pipe(first())
					.subscribe(config => {
						this.log.debug('initialize map')
						this.map = new ChunkedCanvas(
							world.tilemap.shape.map(s => s * config.tileResolution),
							config.chunkSize * config.tileResolution
						)

						this.log.debug('initialize minimap')
						this.minimap = new SingleCanvas(
							createCanvas(world.tilemap.shape.map(s => s * config.minimapResolution))
						)

						this.log.debug('set initial camera')
						this.cameraService.camera.set(new Camera(
							Position.fromShape(world.tilemap.shape).map(c => c / 2),
							config.tileResolution,
							new CameraConfig(
								new Range(1, 1000),
								16
							)
						))

						complete?.()
					})
			})
	}

	/**
	 * Update map and minimap on world changes
	 * TODO: optimize; draw only visible chunks with specified overhead
	 * TODO: optimize; redraw only changed chunks
	 * TODO: notify what tiles need update
	 * @param complete update complete callback
	 */
	private updateChunks(complete?: () => void): void {
		this.worldService.world.observable.subscribe(world => {
			this.log.debug('draw visible chunks')
			const startDrawChunks = new Date()
			this.drawChunks(world.tilemap)
			this.log.debug(`drawn visible chunks in ${(new Date().getTime() - startDrawChunks.getTime())}ms`)

			this.log.debug('draw minimap')
			const startDrawMinimap = new Date()
			this.drawMinimap()
			this.log.debug(`drawn minimap in ${(new Date().getTime() - startDrawMinimap.getTime())}ms`)

			complete?.()
		})
	}

	/**
	 * Update world layer for each new camera update
	 */
	private updateWorldLayer(): void {
		this.configService.renderConfig.observable
			.pipe(first())
			.subscribe(config => {
				this.worldService.world.observable
					.pipe(first())
					.subscribe(world => {
						this.cameraService.camera.observable
							.pipe(
								untilNewFrom(this.configService.renderConfig.observable),
								throttleTime(1000 / (config.maxUps || Infinity))
							)
							.subscribe(camera => {
								if (!this.worldCanvas) return
								this.renderProfileService.frame.set()

								const cyclicCamera = new Camera(
									camera.position.mapEach(
										x => x % world.tilemap.shape.width,
										y => y % world.tilemap.shape.height
									),
									camera.zoom,
									camera.config
								)

								const destinationRect = Rectangle.rectangleByOnePoint(
									Position.ZERO,
									this.worldCanvas.resolution
								)

								if (cyclicCamera.zoom > cyclicCamera.config.minimapTriggerZoom) {
									this.drawMapOnWorldLayer(cyclicCamera, destinationRect)
									this.interactionService.tileHover
										.pipe(first())
										.subscribe(hoverPos =>
											this.drawHoverTile(camera, hoverPos)
										)
								} else {
									this.drawMinimapOnWorldLayer(cyclicCamera, destinationRect)
								}
							})
					})
			})
	}

	/**
	 * Update map view or minimap view based on zoom for each new camera and map update
	 */
	private updateInteractionLayer(): void {
		this.interactionService.tileHover
			.subscribe(hoverPos => {
				this.cameraService.camera.observable
					.pipe(first())
					.subscribe(camera => {
						this.drawHoverTile(camera, hoverPos)
					})
			})
	}

	/**
	 * Resize canvases and update camera
	 * @param shape
	 */
	private resizeCanvas(shape: Shape): void {
		[this.worldCanvas, this.interactionCanvas].forEach(c => c.setResolution(shape))
		this.cameraService.camera.update()
	}

	/**
	 * Draw map on world layer
	 * @param camera
	 * @param destinationRect
	 */
	private drawMapOnWorldLayer(camera: Camera, destinationRect: Rectangle): void {
		this.configService.renderConfig.observable
			.pipe(first())
			.subscribe(config => {
				this.provideUnboundedCameras(camera, this.map.resolution, config.tileResolution, unboundedCamera => {
					this.map.drawPartOn(
						unboundedCamera.getViewCameraRect(this.worldCanvas.resolution, config.tileResolution),
						this.worldCanvas,
						destinationRect
					)
				})
			})
	}

	/**
	 * Draw minimap on world layer
	 * @param camera
	 * @param destinationRect
	 */
	private drawMinimapOnWorldLayer(camera: Camera, destinationRect: Rectangle): void {
		this.configService.renderConfig.observable
			.pipe(first())
			.subscribe(config => {
				this.provideUnboundedCameras(camera, this.minimap.resolution, config.minimapResolution, unboundedCamera => {
					this.worldCanvas.drawImage(
						this.minimap.canvas,
						destinationRect,
						unboundedCamera.getViewCameraRect(this.worldCanvas.resolution, config.minimapResolution)
					)
				})
			})
	}

	/**
	 * Generate all cameras for drawing visible unbounded tiles.
	 * Unbounded means visible due to infinite nature of the enclosed map
	 * @param camera
	 * @param mapResolution
	 * @param tileResolution
	 * @param cameraSupplier
	 */
	private provideUnboundedCameras(camera: Camera, mapResolution: Shape, tileResolution: number, cameraSupplier: (camera: Camera) => void): void {
		const visibleWorldsShape = this.worldCanvas.resolution
			.mapEach(
				w => w / (mapResolution.width * camera.zoom / tileResolution),
				h => h / (mapResolution.height * camera.zoom / tileResolution)
			)
			.map(s => Math.floor(s / 2) + 1)

		_.range(-visibleWorldsShape.width, visibleWorldsShape.width + 2).forEach(x => {
			_.range(-visibleWorldsShape.height, visibleWorldsShape.height + 2).forEach(y => {
				cameraSupplier(
					new Camera(
						camera.position.mapEach(
							c => c + (x * mapResolution.width / tileResolution),
							c => c + (y * mapResolution.height / tileResolution)
						),
						camera.zoom,
						camera.config
					)
				)
			})
		})
	}

	/**
	 * Draw all chunks on map canvas
	 * @param tilemap
	 */
	private drawChunks(tilemap: Matrix<Tile>): void {
		this.map.chunkMatrix.forEach((chunk, position) => {
			if (chunk.isDrawn) return
			this.drawChunk(position, tilemap)
		})
	}

	/**
	 * Draw single chunk on map canvas
	 * @param chunkPosition
	 * @param tilemap
	 */
	private drawChunk(chunkPosition: Position, tilemap: Matrix<Tile>): void {
		this.configService.renderConfig.observable
			.pipe(first())
			.subscribe(config => {
				const chunkTileRect: Rectangle = Rectangle.rectangleByOnePoint(
					chunkPosition.map(c => c * config.chunkSize),
					Shape.square(config.chunkSize)
				)
				const chunkTilemap: Matrix<Tile> = tilemap.of(chunkTileRect)
				this.spriteRenderService.spriteRenderers.forEach(spriteRenderer => {
					chunkTilemap.forEach((tile: Tile, position: Position) => {
						if (!tile) return
						const tilePosition = position.add(chunkTileRect.topLeft)

						spriteRenderer
							.getSprite(
								tile,
								spriteRenderer.needAdjacentTiles
									? this.worldService.getAdjacentTileMatrix(tilemap, tilePosition)
									: null
							)
							.ifPresent(sprite => {
								this.drawMapSprite(
									sprite,
									tilePosition.map(c => c * config.tileResolution)
								)
							})
					})
				})
			})
	}

	/**
	 * Draw each map chunk on minimap canvas
	 */
	private drawMinimap(): void {
		this.configService.renderConfig.observable
			.pipe(first())
			.subscribe(config => {
				this.map.chunkMatrix.forEach((chunk, position) => {
					this.minimap.drawImage(
						chunk.canvas,
						Rectangle
							.rectangleByOnePoint(
								position.map(c => c * config.chunkSize),
								Shape.square(config.chunkSize)
							)
							.multiply(config.minimapResolution)
					)
				})
				this.minimap.drawBorder(1, 'rgba(0, 0, 0, 0.3)')
			})
	}

	/**
	 * Draw sprite on map canvas
	 * @param sprite
	 * @param position
	 */
	private drawMapSprite(sprite: HTMLImageElement, position: Position): void {
		this.configService.renderConfig.observable
			.pipe(first())
			.subscribe(config => {
				const spriteRect = Rectangle.rectangleByOnePoint(
					position,
					new Shape(sprite.width, sprite.height).map(s =>
						(s / config.spriteResolution) * config.tileResolution
					)
				)
				this.map.drawImage(
					sprite,
					spriteRect
				)
			})
	}

	/**
	 * Draw hovered tile highlight
	 * TODO: move to separate service when more of such draws appear
	 * @param camera
	 * @param hoverPos
	 */
	private drawHoverTile(camera: Camera, hoverPos: Position) {
		if (camera.zoom > camera.config.minimapTriggerZoom) {
			this.interactionCanvas.clear()
			this.interactionCanvas.drawImage(
				this.spriteService.fetch('hover'),
				Rectangle.rectangleByOnePoint(
					hoverPos
						.map(c => Math.floor(c))
						.sub(camera.position)
						.map(c => c * camera.zoom)
						.add(Position.fromShape(this.worldCanvas.resolution.map(c => c / 2))),
					Shape.square(camera.zoom)
				)
			)
		} else {
			this.interactionCanvas.clear()
		}
	}

}
