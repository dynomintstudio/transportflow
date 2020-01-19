import {Injectable} from '@angular/core';
import {ObservableData} from "../../common/model/ObservableData";
import {Camera} from "../model/Camera";
import {KeyService} from "../../input/service/key.service";
import {Position} from "../../common/model/Position";
import {filter, first, map, pairwise} from "rxjs/operators";
import {MouseService} from "../../input/service/mouse.service";


@Injectable({
	providedIn: 'root'
})
export class CameraService {

	camera: ObservableData<Camera> = new ObservableData();

	constructor(
		private keyService: KeyService,
		private mouseService: MouseService
	) {
		this.keyService.keypressObservable.observable.subscribe(e => {
			this.camera.observable
				.pipe(first())
				.subscribe((camera: Camera) => {
					if (!e) return;

					if (e.code === 'KeyW') {
						this.camera.set(new Camera(
							camera.position.add(
								new Position(
									0,
									-1
								)
							),
							camera.zoom,
							camera.config
						));
					}
					if (e.code === 'KeyS') {
						this.camera.set(new Camera(
							camera.position.add(
								new Position(
									0,
									1
								)
							),
							camera.zoom,
							camera.config
						));
					}
					if (e.code === 'KeyA') {
						this.camera.set(new Camera(
							camera.position.add(
								new Position(
									-1,
									0
								)
							),
							camera.zoom,
							camera.config
						));
					}
					if (e.code === 'KeyD') {
						this.camera.set(new Camera(
							camera.position.add(
								new Position(
									1,
									0
								)
							),
							camera.zoom,
							camera.config
						));
					}
				});
		});

		this.mouseService.zoomIn.observable.subscribe(() => {
			this.camera.observable
				.pipe(first())
				.subscribe(camera => {
					this.camera.set(new Camera(
						camera.position,
						camera.config.zoomLimit.limit(camera.zoom * camera.config.zoomFactor),
						camera.config
					));
				});
		});

		this.mouseService.zoomOut.observable.subscribe(() => {
			this.camera.observable
				.pipe(first())
				.subscribe(camera => {
					this.camera.set(new Camera(
						camera.position,
						camera.config.zoomLimit.limit(camera.zoom / camera.config.zoomFactor),
						camera.config
					));
				});
		});

		this.mouseService.mouseDrag.observable
			.pipe(
				pairwise(),
				filter(([e1, e2]) => Math.abs(e1.timeStamp - e2.timeStamp) < 100),
				map(a => a.map(e => new Position(e.clientX, e.clientY))),
				map(([p1, p2]) => new Position(p1.x - p2.x, p1.y - p2.y)),
			)
			.subscribe(p => {
				this.camera.observable
					.pipe(first())
					.subscribe(camera => {
						this.camera.set(new Camera(
							camera.position.add(
								new Position(
									p.x / camera.zoom,
									p.y / camera.zoom
								)
							),
							camera.zoom,
							camera.config
						));
					});
			})
	}

}
