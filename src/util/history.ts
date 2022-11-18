import { fabric } from "../../HEADER";

(function() {
    interface snapshot {
        type: string,
        props?: Record<string, any>
        action?: string
        objects?: any[],
        current?: Record<string, any>,
        original?: Record<string, any>
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

            // 添加/删除 反向操作 add -> remove, remove-> add
            if (snapshot.type === 'add') {
                snapshot.type = 'remove'
            } else if (snapshot.type === 'remove') {
                snapshot.type = 'add'
            }

            // 修改 反向操作 current -> original
            snapshot.type === 'modified' ? snapshot.objects?.forEach(obj => {
                const temp = obj.current
                obj.current = obj.original
                obj.original = temp  
            }) : null

            // 清除, 设置背景色，设置背景图 反向操作 current -> original
            if (snapshot.type === 'clear'  || snapshot.type === 'bgColor' || snapshot.type === 'bgImage') {
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
            if (snapshot.type === 'clear' || snapshot.type === 'bgColor' || snapshot.type === 'bgImage') {
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
         *  3. 删除对象 remove
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
            curStack.stack.push(data)
            curStack.currentIndex = curStack.stack.length - 1
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
                case 'modified':
                    this.__objectModified(data, sync)
                    break
                case 'clear':
                    this.__clearCanvas(data)
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
                this.fCanvas.add(object);
            })
            this.fCanvas.requestRenderAll()
        }

        // 修改对象
        __objectModified(data: snapshot, sync: boolean) {
            const  {objects, action} = data
            console.log('__objectModified', data)
            objects?.forEach(obj => {
                const index = this.fCanvas.getObjects().findIndex((i: any) => i.qn.oid === obj.qn.oid)
                if (index > -1) {
                    this.fCanvas.item(index).setOptions(obj.current)

                    // undo/redo 的修改协同
                    fabric.util.socket && fabric.util.socket.draw(Object.assign({}, obj.current, {qn: obj.qn, at: action}))
                }
            })
            this.fCanvas.requestRenderAll()
        }

        // 画布清除
        async __clearCanvas(data: snapshot) {
            const {current} = data
            // if (current?.objects.length) {
            //     current.objects.forEach((i: any) => {
            //         // 收消息标识， 避免load的时候发送socket
            //         i.qn.isReceived = true
            //     })
            // }
            await this.fCanvas.loadFromJSON(current)
            this.fCanvas.requestRenderAll()
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
    }


    window.fabric.util.History = History
  })();
  