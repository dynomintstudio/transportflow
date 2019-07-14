import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';

import {AppComponent} from './app.component';
import {GuiComponent} from './web/gui/gui.component';
import {MenuComponent} from './web/menu/menu.component';
import {CanvasComponent} from './web/canvas/canvas.component';

@NgModule({
	declarations: [
		AppComponent,
		GuiComponent,
		MenuComponent,
		CanvasComponent
	],
	imports: [
		BrowserModule
	],
	providers: [],
	bootstrap: [AppComponent]
})
export class AppModule {
}