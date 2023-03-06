import { fabric } from "../../HEADER";
import { getSyncOptions } from './index';

(function() {
    interface snapshot {
        type: string,
        props?: Record<string, any>
        action?: string
        objects?: any[],
        clearId?: string, // 每次清除会生成一个clearId, recover的时候会用到
        current?: Record<string, any>,
        original?: Record<string, any>
        oids?: string[]
        // canvasJson?: Record<string, any> // 整个画布json
    }

    interface Stack {
        currentIndex: number,
        stack: snapshot[]
    }

    interface Options {
        fCanvas: Record<string, any>,
        pages: Record<string, any>
    }

    class History {
        stackMap: Map<number, Stack>
        fCanvas: Record<string, any>
        pages: Record<string, any>
        uiRender: (() => void) | undefined
        constructor (options: Options) {
            this.stackMap = new Map()
            this.fCanvas = options.fCanvas
            this.pages = options.pages
            window.fabric.util.history= this
        }
        get lastIndex () {
            const curStack = this._getCurrentStack()
            return curStack.stack.length -1 
        }

        get canUndo () {
            const curStack = this._getCurrentStack()
            return curStack.currentIndex > -1
        }
        get canRedo () {
            const curStack = this._getCurrentStack()
            return curStack.currentIndex < this.lastIndex
        }

        setUiRender (fn: () => void) {
            this.uiRender = fn
        }

        getCurrentStack () {
            const curStack = this._getCurrentStack()
            return curStack.stack[curStack.currentIndex]
        }

        /**
         * 删除指定页的历史记录
         * @param pageId 
         */
        deleteStackByPageId (pageId: number) {
            this.stackMap.delete(pageId)
            this.uiRender && this.uiRender()
        }

        /**
         * 
         * @param sync true: 主动undo/redo， false: 被动undo/redo， 被动时不需要再次协同
         * @param callback 
         * @returns 
         */
        undo (sync=true, callback: () => void) {
            const curStack = this._getCurrentStack()
            if (!curStack.stack.length || curStack.currentIndex <= -1) return
            const snapshot = curStack.stack[curStack.currentIndex]

            // 添加/删除 反向操作 add -> remove, remove-> add, delete -> deleteAdd,  deleteAdd -> delete
            if (snapshot.type === 'add') {
                snapshot.type = 'remove'
            } else if (snapshot.type === 'remove') {
                snapshot.type = 'add'
            } else if (snapshot.type === 'delete') {
                snapshot.type = 'deleteAdd'
            } else if (snapshot.type === 'deleteAdd') {
                snapshot.type = 'delete'
            } else if (snapshot.type === 'clear') {
                snapshot.type = 'recoverClear'
            } else if (snapshot.type === 'recoverClear') {
                snapshot.type = 'clear'
            } else if (snapshot.type === 'eraser') {
                snapshot.type = 'recoverEraser'
            } else if (snapshot.type === 'recoverEraser') {
                snapshot.type = 'eraser'
            }

            // 修改 反向操作 current -> original
            snapshot.type === 'modified' ? snapshot.objects?.forEach(obj => {
                const temp = obj.current
                obj.current = obj.original
                obj.original = temp  
            }) : null

            // 清除, 设置背景色，设置背景图 反向操作 current -> original
            if (snapshot.type === 'bgColor' || snapshot.type === 'bgImage') {
                const temp = snapshot.current
                snapshot.current = snapshot.original
                snapshot.original = temp
                snapshot.current?.objects.forEach((obj: any) => {
                    obj.qn.sync = true
                })
            }

            this._handle(snapshot, sync)
            if (curStack.currentIndex > -1) {
                curStack.currentIndex -= 1
                this._setCurrentStack(curStack)
            }
            console.log('stack currentIndex', curStack.currentIndex)
            this.uiRender && this.uiRender()

            // sync && window.fabric.util.socket && window.fabric.util.socket.sendCmd({ cmd: "undo" })
            callback && callback()
        }
        
        redo (sync=true, callback: () => void) {
            const curStack = this._getCurrentStack()
            if (!curStack.stack.length || curStack.currentIndex == this.lastIndex) return
            if (curStack.currentIndex < this.lastIndex) {
                curStack.currentIndex += 1
                this._setCurrentStack(curStack)
            }
            const snapshot = curStack.stack[curStack.currentIndex]

            // 添加/删除 反向操作 add -> remove, remove-> add
            if (snapshot.type === 'add') {
                snapshot.type = 'remove'
            } else if (snapshot.type === 'remove') {
                snapshot.type = 'add'
            } else if (snapshot.type === 'delete') {
                snapshot.type = 'deleteAdd'
            } else if (snapshot.type === 'deleteAdd') {
                snapshot.type = 'delete'
            } else if (snapshot.type === 'clear') {
                snapshot.type = 'recoverClear'
            } else if (snapshot.type === 'recoverClear') {
                snapshot.type = 'clear'
            } else if (snapshot.type === 'eraser') {
                snapshot.type = 'recoverEraser'
            } else if (snapshot.type === 'recoverEraser') {
                snapshot.type = 'eraser'
            }

            // 反向操作 original -> current
            snapshot.type === 'modified' ? snapshot.objects?.forEach(obj => {
                const temp = obj.current
                obj.current = obj.original
                obj.original = temp
                snapshot.current?.objects.forEach((obj: any) => {
                    obj.qn.sync = true
                })
            }) : null

            // 清除, 设置背景色，设置背景图 反向操作 current -> original
            if (snapshot.type === 'bgColor' || snapshot.type === 'bgImage') {
                const temp = snapshot.current
                snapshot.current = snapshot.original
                snapshot.original = temp
            }

            this._handle(snapshot, sync)

            this.uiRender && this.uiRender()

            // sync && window.fabric.util.socket && window.fabric.util.socket.sendCmd({ cmd: "redo" })
            callback && callback()
        }

        /**
         * 需要入栈的行为
         *  1. 新建对象 add
         *  2. 修改对象（单个、group） modified
         *  3. 删除对象 delete/remove
         *  4. clear clear
         *  5. 设置背景 setBgColor/setBgImg
         *  6. 橡皮擦
         */
        push (data: snapshot) {
            const curStack = this._getCurrentStack()
            const { objects } = data
            objects?.forEach(obj => {
                const {qn} = obj
                qn.sync = true
            })
            console.log('====history push before====',curStack.stack.length, curStack.stack)

            // 每次有新内容的时候删除之前undo的内容
            const removeStoreIds = []
            for (let i = 0; i < curStack.stack.length; i++) {
                const item = curStack.stack[i]
                if (item && (item.type === 'remove' || item.type === 'recoverClear' || item.type === 'recoverEraser')) {
                    curStack.stack.splice(i, 1)
                    if (item.objects && item.objects.length) {
                        const oids = item.objects.map(obj => obj.qn.oid)
                        removeStoreIds.push(...oids)
                    }
                    console.log('====history push remove====',curStack.stack.length, curStack.stack)
                    i -= 1
                }
            }
            if (removeStoreIds.length) {
                // 通知remove storepath
                console.log('remove store Path', removeStoreIds)
                fabric.util.socket && fabric.util.socket.sendCmd({ cmd: "rs", oids: removeStoreIds})
            }
            console.log('====history push====',data)
            curStack.stack.push(data)
            // if (!(window as any).historyPushNum) {
            //     (window as any).historyPushNum = 1
            // } else {
            //     (window as any).historyPushNum += 1
            // }
            curStack.currentIndex = curStack.stack.length - 1
            console.log(`history push pageId:${this.pages.currentPageId}, currentIndex:${curStack.currentIndex}, stack: ${curStack.stack.length}`)
            this._setCurrentStack(curStack)
            this.uiRender && this.uiRender()
        }

        _handle (data: snapshot, sync: boolean) {
            // 清空selection
            this.fCanvas.discardActiveObject().renderAll();
            const {type}  = data
            switch (type) {
                case 'add':
                    this.__objectAdd(data, sync)
                break
                case 'remove':
                    this.__objectRemove(data, sync)
                    break
                case 'deleteAdd':
                    this.__objectAdd(data, sync)
                    break
                case 'delete':
                    this.__objectRemove(data, sync)
                    break
                case 'modified':
                    this.__objectModified(data, sync)
                    break
                case 'clear':
                    this.__clearCanvas(data, sync)
                    break
                case 'recoverClear':
                    this.__recoverClearCanvas(data, sync)
                    break
                case 'eraser':
                    this.__addEraser(data, sync)
                    break
                case 'recoverEraser':
                    this.__removeEraser(data, sync)
                    break
                case 'bgColor':
                    this.__setBackgroundColor(data)
                    break
                case 'bgImage':
                    this.__setBackgroundImage(data)

            }
            console.log('hitroay stackMap', this.stackMap, this.pages)
        }

        // 删除对象
        __objectRemove(data: snapshot, sync: boolean) {
            const {objects} = data
            objects?.forEach(object => {
                object.qn.sync = sync
                object.qn.noHistoryStack = true
                console.log('__objectRemove', object)
                this.fCanvas.remove(object);
            })
            this.fCanvas.requestRenderAll()
        }

        // 添加对象
        __objectAdd(data: snapshot, sync: boolean) {
            const {objects} = data
            objects?.forEach(object => {
                object.qn.sync = sync
                object.qn.noHistoryStack = true
                const ratioObject = this._getRatioObject(object)
                if (!ratioObject.opacity || ratioObject.opacity !== 1) {
                    ratioObject.set('opacity', 1)
                }
                // 设备适配
                this.fCanvas.add(ratioObject);
            })
            this.fCanvas.requestRenderAll()
        }

        // 修改对象
        __objectModified(data: snapshot, sync: boolean) {
            const  {objects, action} = data
            const mos: any = {}
            objects?.forEach(obj => {
                const index = this.fCanvas.getObjects().findIndex((i: any) => i.qn.oid === obj.qn.oid)
                if (index > -1) {
                    const ratioObject = this._getRatioObject(Object.assign({}, obj.current, {qn:obj.qn}))
                    this.fCanvas.item(index).setOptions(ratioObject)
                    // this.fCanvas.item(index).setCoords()
                    const mosCopy = JSON.parse(JSON.stringify(obj.current))
                    mosCopy.qn = {
                        w: this.fCanvas.getWidth()
                    }
                    mos[obj.qn.oid] = mosCopy
                }
            })
            // 批量修改
            console.log('undo redo 批量修改', {cmd: 'bm', mos, at: action})
            fabric.util.socket && fabric.util.socket.sendCmd({cmd: 'bm', mos, at: action})
            // fabric.util.socket && fabric.util.socket.draw(Object.assign({}, obj.current, {qn: obj.qn, at: action}))
            this.fCanvas.requestRenderAll()
        }

        // 画布清除
        // 这里应该改为 clear recovery
        async __clearCanvas(data: snapshot, sync: boolean) {
            console.log('__clearCanvas', data, sync)
            const {objects, clearId} = data
            const curObjects = this.fCanvas.getObjects()
            if (objects) {
                const removeObjIds = objects.map(obj => obj.qn.oid)
                const removeObjects = curObjects.filter((obj: any) => {
                    if (removeObjIds.includes(obj.qn.oid)) {
                        obj.qn.noHistoryStack = true
                        obj.qn.sync = false
                        return true
                    }
                    return false
                })
                const eraserOids: any[] = []
                removeObjects.forEach((obj: any) => {
                    if (obj.eraser) {
                        const eraserObjects = obj.eraser._objects || obj.eraser.objects
                        eraserObjects.length && eraserObjects.forEach((j: any) => {
                            if (!eraserOids.includes(j.qn.oid)) {
                                eraserOids.push(j.qn.oid)
                            }
                        })
                    }
                })
                await this.fCanvas.remove(...removeObjects)
                fabric.util.socket && fabric.util.socket.sendCmd({ cmd: "clear", oids: removeObjIds, eids: eraserOids, cid: clearId})
            }
            // console.log('__clearCanvas', current)
            // if (current && current.objects.length) {
            //     const curObjects = this.fCanvas.getObjects()
            //     const curObj =JSON.parse(JSON.stringify(current))
            //     curObj.objects.push(...curObjects) 
            //     this.fCanvas.loadFromJSON(curObj)
            // } else {
            //     await this.fCanvas.loadFromJSON(current)
            // }
            this.fCanvas.requestRenderAll()
        }

        // 恢复被清除的内容
        async __recoverClearCanvas (data: snapshot, sync: boolean) {
            const {objects, clearId} = data
            const oids: any[] = []
            const eraserOids: any[] = []
            if (objects) {
                objects.forEach(obj => {
                    obj.qn.sync = false
                    obj.qn.noHistoryStack = true
                    oids.push(obj.qn.oid)
                    if (obj.eraser) {
                        obj.eraser._objects ? obj.eraser.objects = obj.eraser._objects : null
                        const eraserObjects = obj.eraser.objects
                        eraserObjects.length && eraserObjects.forEach((j: any) => {
                            if (!eraserOids.includes(j.qn.oid)) {
                                eraserOids.push(j.qn.oid)
                            }
                        })
                    }
                })
                const json = this.fCanvas.toJSON()
                json.objects.push(...objects) 
                await this.fCanvas.loadFromJSON(JSON.parse(JSON.stringify(json)))
                await this.fCanvas.requestRenderAll()
                fabric.util.socket && fabric.util.socket.sendCmd({ cmd: "rc", oids, cid: clearId, eids: eraserOids})
            }
        }

        // 添加橡皮擦
        async __addEraser (data: snapshot, sync: boolean){
            const {objects} = data
            objects?.forEach((obj:any) => {
                if (obj) {
                    window.fabric.EraserBrush.prototype._renderEraserByPath.call(
                        window.fabric.EraserBrush.prototype,
                        this.fCanvas,
                        obj
                      );
                    const syncOptions = getSyncOptions(obj)
                    console.log('__addEraser:', obj)
                    fabric.util.socket && fabric.util.socket.sendCmd({ cmd: "ae", epid: obj.qn.oid, options: syncOptions })
                }
            })
            this.fCanvas.requestRenderAll()
        }

        // 删除橡皮擦轨迹
        async __removeEraser(data: snapshot, sync: boolean) {
            const {objects} = data
            objects?.forEach((eraserPath:any) => {
                window.fabric.EraserBrush.prototype._removeEraserByPath.call(
                    window.fabric.EraserBrush.prototype,
                    this.fCanvas,
                    eraserPath
                  );
                const epid = eraserPath.qn.oid
                eraserPath.qn.t = 're'
                // fabric.util.socket && fabric.util.socket.draw(Object.assign({},{epid}, {qn: eraserPath.qn}))
                fabric.util.socket && fabric.util.socket.sendCmd({ cmd: "re", epid })
            })
            this.fCanvas.requestRenderAll();
        }

        // 设置背景色
        __setBackgroundColor(data: snapshot) {
            const {current} = data
            this.fCanvas.setBgColorOrBgImgForUndoRedo(current, false)
            console.log('__setBackgroundColor', data)
            this.fCanvas.requestRenderAll()
            fabric.util.socket && fabric.util.socket.sendCmd({ cmd: "bgColor", color: current })
        }

        // 设置背景图片
        __setBackgroundImage(data: snapshot) {
            const {current} = data
            this.fCanvas.setBgColorOrBgImgForUndoRedo(current, false)
            console.log('__setBackgroundImage', data)
            this.fCanvas.requestRenderAll()
            fabric.util.socket && fabric.util.socket.sendCmd({ cmd: "bgImg", url: current?._element.currentSrc })
        }

        /**
         * 获取当前页stack
         * @returns 
         */
        private _getCurrentStack () {
            // console.log('====当前pageId====', this.pages.currentPageId)
            const curStack = this.stackMap.get(this.pages.currentPageId) || {currentIndex: -1, stack: []}
            // console.log('获取当前页stack', curStack)
            return curStack
        }

        /**
         * 更新当前当前页stack
         * @param stack 
         */
        private _setCurrentStack (stack: Stack) {
            this.stackMap.set(this.pages.currentPageId, stack)
        }

        // 获取设备适配后的object
        private _getRatioObject (object: any) {
            const curWidth = this.fCanvas.getWidth();
            const curHeight = this.fCanvas.getHeight();
            const {qn} = object
            const defaultProps = ['scaleX', 'scaleY', 'left', 'top']
            const ratioX = curWidth / qn.w;
            // const ratioY = curHeight / qn.h;
            object.scaleX && (object.scaleX = ((object.scaleX as number) || 1) * ratioX)
            object.left && (object.left = (object.left as number) * ratioX);
            object.scaleY && (object.scaleY = ((object.scaleY as number) || 1) * ratioX)
            object.top && (object.top = (object.top as number) * ratioX);
            qn.w = curWidth;
            qn.h = curHeight;
            console.log('undo redo ratio', object)
            return object
        }
    }


    window.fabric.util.History = History
  })();
  