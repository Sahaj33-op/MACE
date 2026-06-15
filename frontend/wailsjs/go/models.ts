export namespace downloader {
	
	export class CurseForgeSearchResult {
	    id: number;
	    name: string;
	    description: string;
	    author: string;
	    iconUrl: string;
	    downloads: number;
	    source: string;
	    classId: number;
	
	    static createFrom(source: any = {}) {
	        return new CurseForgeSearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.author = source["author"];
	        this.iconUrl = source["iconUrl"];
	        this.downloads = source["downloads"];
	        this.source = source["source"];
	        this.classId = source["classId"];
	    }
	}
	export class HangarSearchResult {
	    name: string;
	    slug: string;
	    owner: string;
	    description: string;
	    iconUrl: string;
	    downloads: number;
	    source: string;
	
	    static createFrom(source: any = {}) {
	        return new HangarSearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.slug = source["slug"];
	        this.owner = source["owner"];
	        this.description = source["description"];
	        this.iconUrl = source["iconUrl"];
	        this.downloads = source["downloads"];
	        this.source = source["source"];
	    }
	}
	export class ModrinthSearchResult {
	    id: string;
	    slug: string;
	    name: string;
	    description: string;
	    author: string;
	    iconUrl: string;
	    downloads: number;
	    source: string;
	
	    static createFrom(source: any = {}) {
	        return new ModrinthSearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.slug = source["slug"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.author = source["author"];
	        this.iconUrl = source["iconUrl"];
	        this.downloads = source["downloads"];
	        this.source = source["source"];
	    }
	}
	export class SpigetSearchResult {
	    id: number;
	    name: string;
	    description: string;
	    author: string;
	    iconUrl: string;
	    downloads: number;
	    premium: boolean;
	    external: boolean;
	    source: string;
	
	    static createFrom(source: any = {}) {
	        return new SpigetSearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.author = source["author"];
	        this.iconUrl = source["iconUrl"];
	        this.downloads = source["downloads"];
	        this.premium = source["premium"];
	        this.external = source["external"];
	        this.source = source["source"];
	    }
	}

}

export namespace servermanager {
	
	export class BackupItem {
	    fileName: string;
	    sizeKB: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new BackupItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.fileName = source["fileName"];
	        this.sizeKB = source["sizeKB"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class ContentItem {
	    name: string;
	    fileName: string;
	    enabled: boolean;
	    sizeKB: number;
	    type: string;
	
	    static createFrom(source: any = {}) {
	        return new ContentItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.fileName = source["fileName"];
	        this.enabled = source["enabled"];
	        this.sizeKB = source["sizeKB"];
	        this.type = source["type"];
	    }
	}
	export class CreateServerPayload {
	    name: string;
	    version: string;
	    type: string;
	    memoryMB: number;
	    backupPath: string;
	    agreeEula: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CreateServerPayload(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.version = source["version"];
	        this.type = source["type"];
	        this.memoryMB = source["memoryMB"];
	        this.backupPath = source["backupPath"];
	        this.agreeEula = source["agreeEula"];
	    }
	}
	export class ImportServerPayload {
	    path: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new ImportServerPayload(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	    }
	}
	export class ModpackMeta {
	    name: string;
	    version: string;
	    source: string;
	
	    static createFrom(source: any = {}) {
	        return new ModpackMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.version = source["version"];
	        this.source = source["source"];
	    }
	}
	export class ServerInstance {
	    id: string;
	    name: string;
	    version: string;
	    type: string;
	    path: string;
	    status: string;
	    javaPath: string;
	    memoryMB: number;
	    world: string;
	    ipAddress: string;
	    port: number;
	    watchdog: boolean;
	    backupPath: string;
	    modpack?: ModpackMeta;
	
	    static createFrom(source: any = {}) {
	        return new ServerInstance(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.version = source["version"];
	        this.type = source["type"];
	        this.path = source["path"];
	        this.status = source["status"];
	        this.javaPath = source["javaPath"];
	        this.memoryMB = source["memoryMB"];
	        this.world = source["world"];
	        this.ipAddress = source["ipAddress"];
	        this.port = source["port"];
	        this.watchdog = source["watchdog"];
	        this.backupPath = source["backupPath"];
	        this.modpack = this.convertValues(source["modpack"], ModpackMeta);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UpdateConfigPayload {
	    id: string;
	    name: string;
	    javaPath: string;
	    memoryMB: number;
	    port: number;
	    watchdog: boolean;
	    rawProps: string;
	    version: string;
	    type: string;
	    backupPath: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateConfigPayload(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.javaPath = source["javaPath"];
	        this.memoryMB = source["memoryMB"];
	        this.port = source["port"];
	        this.watchdog = source["watchdog"];
	        this.rawProps = source["rawProps"];
	        this.version = source["version"];
	        this.type = source["type"];
	        this.backupPath = source["backupPath"];
	    }
	}

}

export namespace utils {
	
	export class AppSettings {
	    curseForgeApiKey: string;
	
	    static createFrom(source: any = {}) {
	        return new AppSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.curseForgeApiKey = source["curseForgeApiKey"];
	    }
	}
	export class JavaInstall {
	    path: string;
	    version: string;
	
	    static createFrom(source: any = {}) {
	        return new JavaInstall(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.version = source["version"];
	    }
	}

}

