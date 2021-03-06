import {Injectable} from '@angular/core'
import {TiledTerrain} from '../model/TiledTerrain'
import {TerrainGenerationConfig} from '../config/TerrainGenerationConfig'
import {TerrainTile} from '../model/TerrainTile'
import {Matrix} from '../../../common/model/Matrix'

import * as _ from 'lodash'
import {Position} from '../../../common/model/Position'
import {NoiseService} from '../../../common/service/noise.service'
import {FractionService} from '../../../common/service/fraction.service'
import {Surface} from '../../../game-logic/model/Surface'
import {Biome} from '../../../game-logic/model/Biome'
import {RandomService} from '../../../common/service/random.service'
import {DistributionService} from '../../../common/service/distribution.service'
import {MatcherService} from '../../../common/service/matcher.service'
import {Log} from '../../../common/model/Log'

/**
 * Terrain generation service. Responsible for terrain generation
 */
@Injectable({
	providedIn: 'root'
})
export class TerrainGenerationService {

	log: Log = new Log(this)

	/**
	 * Constructs service
	 * @param noiseService
	 * @param fractionService
	 * @param randomService
	 * @param matcherService
	 * @param distributionService
	 * @param randomService
	 * @param distributionService
	 */
	constructor(
		private noiseService: NoiseService,
		private fractionService: FractionService,
		private randomService: RandomService,
		private matcherService: MatcherService,
		private distributionService: DistributionService
	) {}

	/**
	 * Generates tiled terrain by specified config
	 * @param config terrain generation config
	 */
	generate(config: TerrainGenerationConfig): TiledTerrain {
		this.log.debug('distribute city points')
		const cityPoints = this.distributionService.distribute(config.mapSize, config.cityPerTile)

		const tiledTerrain = new TiledTerrain(
			new Matrix<TerrainTile>(config.mapSize),
			cityPoints
		)

		this.log.debug('generate terrain tilemap')
		const start = new Date()

		_.range(config.mapSize.width).forEach(x => {
			_.range(config.mapSize.height).forEach(y => {
				const position = new Position(x, y)
				const terrainTile = this.generateTile(config, position, tiledTerrain.cityPoints)
				tiledTerrain.tilemap.set(position, terrainTile)
			})
		})

		this.log.debug(`tilemap generation complete in ${(new Date().getTime() - start.getTime())}ms`)

		return tiledTerrain
	}

	/**
	 * Generate terrain tile
	 * @param config
	 * @param position
	 * @param cityPoints
	 */
	private generateTile(config: TerrainGenerationConfig, position: Position, cityPoints: Position[]): TerrainTile {
		let terrainTile = new TerrainTile()

		terrainTile.surface = this.tileSurface(config, position)
		terrainTile.biome = this.tileBiome(config, position)
		if (terrainTile.surface.type !== 'water') {
			terrainTile.isSnow = this.tileIsSnow(config, position)
		}
		if (terrainTile.surface.type === 'land') {
			terrainTile.isPlant = this.tileIsPlant(config, position, terrainTile.biome)
			terrainTile.isCity = this.tileIsCity(position, cityPoints)
		}

		return terrainTile
	}

	/**
	 * Generates surface
	 * @param config
	 * @param position
	 */
	private tileSurface(config: TerrainGenerationConfig, position: Position): Surface {
		const pattern = this.fractionService.in(
			this.fractionService.calculateRanges([
				config.altitudeMapConfig.waterFraction,
				config.altitudeMapConfig.landFraction,
				config.altitudeMapConfig.mountainFraction
			]),
			this.noiseService.generate(
				position.add(Position.fromShape(config.mapSize)),
				config.altitudeMapConfig.noiseConfig,
				config.mapSize
			)
		)

		return this.matcherService.match<number, Surface>(pattern, new Map([
			[0, new Surface('water')],
			[1, new Surface('land')],
			[2, new Surface('mountain')]
		])).get()
	}

	/**
	 * Generates biome
	 * @param config
	 * @param position
	 */
	private tileBiome(config: TerrainGenerationConfig, position: Position): Biome {
		const pattern = this.fractionService.in(
			this.fractionService.calculateRanges([
				config.humidityMapConfig.desertFraction,
				config.humidityMapConfig.taigaFraction,
				config.humidityMapConfig.jungleFraction
			]),
			this.noiseService.generate(
				position.add(Position.fromShape(config.mapSize).map(c => c * 2)),
				config.humidityMapConfig.noiseConfig,
				config.mapSize
			)
		)

		const seaLevelAltitude = this.fractionService.calculateRanges([
			config.altitudeMapConfig.waterFraction,
			config.altitudeMapConfig.landFraction,
			config.altitudeMapConfig.mountainFraction
		])[0].to

		const altitude = this.noiseService.generate(
			position.add(Position.fromShape(config.mapSize)),
			config.altitudeMapConfig.noiseConfig,
			config.mapSize
		)
		if (altitude - seaLevelAltitude < config.beachHeight)
			return new Biome('desert', config.biomesConfig.desertBiomeConfig)

		return this.matcherService.match<number, Biome>(pattern, new Map([
			[0, new Biome('desert', config.biomesConfig.desertBiomeConfig)],
			[1, new Biome('taiga', config.biomesConfig.taigaBiomeConfig)],
			[2, new Biome('jungle', config.biomesConfig.jungleBiomeConfig)],
		])).get()
	}

	/**
	 * Is tile is in snow
	 * @param config
	 * @param position
	 */
	private tileIsSnow(config: TerrainGenerationConfig, position: Position): Boolean {
		const pattern = this.fractionService.in(
			this.fractionService.calculateRanges([
				config.temperatureMapConfig.landFraction,
				config.temperatureMapConfig.snowFraction
			]),
			this.noiseService.generate(
				position.add(Position.fromShape(config.mapSize).map(c => c * 3)),
				config.temperatureMapConfig.noiseConfig,
				config.mapSize
			)
		)

		return pattern === 1
	}

	/**
	 * Is tile has plant
	 * @param config
	 * @param position
	 * @param biome
	 */
	private tileIsPlant(config: TerrainGenerationConfig, position: Position, biome: Biome): Boolean {
		const probability = this.noiseService.generate(
			position.add(Position.fromShape(config.mapSize).map(c => c * 4)),
			config.fertilityNoiseConfig,
			config.mapSize
		)
		const isTreeByNoise: Boolean = this.randomService.withProbability(biome.config.plantK)
			? probability >= 0.5
			: false
		return isTreeByNoise || this.randomService.withProbability(config.randomTreeProbability * biome.config.plantK)
	}

	/**
	 * Is specified tile match city starting point
	 * @param position
	 * @param cityPoints
	 */
	private tileIsCity(position: Position, cityPoints: Position[]): Boolean {
		return !!cityPoints.find(p => p.x === position.x && p.y === position.y)
	}

}
