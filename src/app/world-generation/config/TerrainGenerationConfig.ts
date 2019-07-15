import {Shape} from "../../common/model/Shape";
import {TemperatureMapConfig} from "./TemperatureMapConfig";
import {AltitudeMapConfig} from "./AltitudeMapConfig";
import {HumidityMapConfig} from "./HumidityMapConfig";

/**
 * Configuration of terrain generation
 */
export class TerrainGenerationConfig {

	/**
	 * Tilemap size in tiles
	 */
	mapSize: Shape;

	/**
	 * Probability of city appearance per tile. Between 0 and 1
	 */
	cityPerTile: number;

	/**
	 * Probability of plant appearance per tile. Between 0 and 1
	 */
	plantPerTile: number;

	/**
	 * Altitude map configuration
	 */
	altitudeMapConfig: AltitudeMapConfig;

	/**
	 * Temperature map configuration
	 */
	temperatureMapConfig: TemperatureMapConfig;

	/**
	 * Humidity map configuration
	 */
	humidityMapConfig: HumidityMapConfig;

}