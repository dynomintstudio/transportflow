import {Building} from "../../../game-logic/model/Building";
import {Road} from "../../street/Road";

/**
 * Output of the city generator. City in it does not applied to terrain underneath (There is no terrain where it will be
 * placed yet, actually)
 */
export class GeneratedCityTemplate {

	/**
	 * City roads
	 */
	roads: Road[];

	/**
	 * City buildings
	 */
	buildings: Building[];

}