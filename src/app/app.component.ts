import {Component} from '@angular/core';
import {InitService} from "./common/service/init.service";
import {TerrainGenerationService} from "./generation/terrain/service/terrain-generation.service";
import {TerrainGenerationConfig} from "./generation/terrain/config/TerrainGenerationConfig";
import {Shape} from "./common/model/Shape";
import {AltitudeMapConfig} from "./generation/terrain/config/AltitudeMapConfig";
import {NoiseConfig} from "./generation/math/config/NoiseConfig";
import {TemperatureMapConfig} from "./generation/terrain/config/TemperatureMapConfig";
import {HumidityMapConfig} from "./generation/terrain/config/HumidityMapConfig";

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent {

	constructor(
		private initService: InitService,
		private terrainGenerationService: TerrainGenerationService
	) {
		let tiledTerrain = this.terrainGenerationService.generate(
			new TerrainGenerationConfig(
				new Shape(
					10,
					10
				),
				0,
				0,
				new AltitudeMapConfig(
					new NoiseConfig(
						0.1
					),
					1,
					2,
					1
				),
				new TemperatureMapConfig(
					new NoiseConfig(),
					1,
					1
				),
				new HumidityMapConfig(
					new NoiseConfig(),
					1,
					1,
					1
				)
			)
		);

		console.table(
			tiledTerrain.tilemap.map(t => t.surface.type).value
		);
	}

}
