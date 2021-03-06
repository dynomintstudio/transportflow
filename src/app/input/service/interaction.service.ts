import {Injectable} from '@angular/core'
import {interval, Observable} from 'rxjs'
import * as _ from 'lodash'
import {distinctUntilChanged, first, map, scan, throttleTime, withLatestFrom} from 'rxjs/operators'
import {lerp} from '../../common/model/Lerp'
import {Camera} from '../../render/model/Camera'
import {CameraService} from '../../render/service/camera.service'
import {WorldService} from '../../game-logic/service/world.service'
import {MouseService} from './mouse.service'
import {Position} from '../../common/model/Position'
import {ConfigService} from '../../common/service/config.service'
import {untilNewFrom} from '../../common/operator/until-new-from.operator'

/**
 * Provides observables for interaction events, such as tile manipulation and camera animation
 */
@Injectable({
	providedIn: 'root'
})
export class InteractionService {

	/**
	 * Observable of mouse hovering over tiles
	 */
	tileHover: Observable<Position>

	/**
	 * Observable of mouse clicking on tiles
	 */
	tileClick: Observable<Position>

	constructor(
		private cameraService: CameraService,
		private worldService: WorldService,
		private mouseService: MouseService,
		private configService: ConfigService
	) {
		this.handleSmoothZoom()

		this.tileHover = this.mouseService.mouseMove.observable
			.pipe(
				map(mouse => new Position(mouse.clientX, mouse.clientY)),
				// TODO: refactor
				// problem with circular dependency
				withLatestFrom(
					this.mouseService.mouseMove.observable,
					(pos, e) => pos
						.add(new Position(
							(<HTMLCanvasElement>e.target).width,
							(<HTMLCanvasElement>e.target).height
							).map(c => -c / 2)
						)
				),
				withLatestFrom(
					this.cameraService.camera.observable,
					(pos, camera) => pos
						.map(c => c / camera.zoom)
						.add(camera.position)
				),
				map(position => position.floor()),
				distinctUntilChanged(_.isEqual)
			)

		this.tileClick = this.mouseService.mouseClick.observable
			.pipe(
				withLatestFrom(this.tileHover, (_, pos) => pos)
			)
	}

	private handleSmoothZoom() {
		this.configService.renderConfig.observable
			.pipe(first())
			.subscribe(renderConfig => {
				interval()
					.pipe(
						untilNewFrom(this.configService.renderConfig.observable),
						withLatestFrom(this.cameraService.zoom.observable, (_, z) => z),
						scan((current, next) => lerp(current, next, renderConfig.zoomAnimationSpeed)),
						map(z => Math.round(z * 10) / 10),
						distinctUntilChanged(),
						throttleTime(1000 / (renderConfig.animationUps || Infinity))
					)
					.subscribe(zoom => {
						this.cameraService.camera.observable
							.pipe(first())
							.subscribe(camera => {
								this.cameraService.camera.set(new Camera(
									camera.position,
									zoom,
									camera.config
								))
							})
					})
			})
	}

}
