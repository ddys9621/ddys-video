<?php

namespace app\admin\controller;

use think\Controller;
use think\Cookie;
use think\Db;
use app\common\util\PclZip;
use app\common\util\Dir;

set_time_limit(0);
include ROOT_PATH . 'niuniuzs/func/func.php';

class Auto extends Base
{

    public function __construct()
    {
        parent::__construct();
    }
    // 初始化
    public function initialize()
    {
        $filenav = APP_PATH . 'extra/quickmenu.php';
        $lod_nav = '牛牛助手,auto/index';
        $nav = '牛牛助手,auto/index';
        if (file_exists($filenav)) {
            $nav_lod = config('quickmenu');
            if (in_array($nav, $nav_lod)) {
                return true;
            }
            if (in_array($lod_nav, $nav_lod)) {
                foreach ($nav_lod as $v) {
                    if ($v != $lod_nav) {
                        $nav_lod2[] = $v;
                    }
                }
                $nav_lod = $nav_lod2;
            }
            $nav_new[] = $nav;
            $new_nav = array_merge($nav_lod, $nav_new);
            $res = mac_arr2file(APP_PATH . 'extra/quickmenu.php', $new_nav);
        }
        $filenav = APP_PATH . 'data/config/quickmenu.txt';
        if (file_exists($filenav)) {
            $nav_lod = @file_get_contents($filenav);
            if (strpos($nav_lod, $lod_nav) !== false) {
                $nav_lod = str_replace(PHP_EOL . $lod_nav, "", $nav_lod);
            }
            if (strpos($nav_lod, $nav) !== false) {
                return true;
            } else {
                $new_nav = $nav_lod . PHP_EOL . $nav;
                @fwrite(fopen($filenav, 'wb'), $new_nav);
            }
        }
        //清理缓存
        $request = controller('admin/index');
        //$request->clear();
    }

    public function apidata()
    {
        $apiconf = include(ROOT_PATH . 'niuniuzs/conf/nnzs.php');
        $tokenarr= include(ROOT_PATH . 'niuniuzs/conf/conf.php');
        
        $apiurl = $apiconf['url'];
        $ckey = 'apicache';
        $apiarr = \think\Cache::get($ckey);
        if ($apiarr === false || $apiarr === null) {
            $res = mac_curl_gets($apiurl . '/?macapi');
            $apiarr = auto_json_decode($res);
            \think\Cache::set($ckey, $apiarr, 1800);
        }
        if (!is_array($apiarr)) {
            $res = mac_curl_gets($apiurl . '/?macapi');
            $apiarr = auto_json_decode($res);
            \think\Cache::set($ckey, $apiarr, 1800);
        }

        return [
            'token'=>$tokenarr['auth_key'],
            'hostversion' => $apiconf['version'],
            'info' => $apiarr['info'],
            'version' => $apiarr['code'],
            'imglist' => $apiarr['imglist'],
            'apilist' => $apiarr['apilist'],
            'apijsonlist' => $apiarr['apijsonlist'],
            'replist' => $apiarr['replist'],
            'imgadlist' => $apiarr['imgad'],
            'nvalist' => $apiarr['nva'],
            'topinfo' => $apiarr['topinfo'],
            'type' => $apiarr['type'],
            'code'=> $apiarr['code'],
            'restype' => $apiarr['restype'],
            'news' => $apiarr['news'],
            'hb' => $apiarr['hb'],

        ];
    }
    public function into($apitype = 'v')
    {
        $data = $this->apidata();
        $typearr = array(
            'type_id' => '',
            'type_mid' => 1,
            'type_status' => 1,
            'type_sort' => '',
            'type_en' => '',
            'type_tpl' => 'type.html',
            'type_tpl_list' => 'show.html',
            'type_tpl_detail' => 'detail.html',
            'type_tpl_play' => '',
            'type_tpl_down' => '',
            'type_title' => '',
            'type_key' => '',
            'type_des' => '',
            'type_logo' => '',
            'type_pic' => '',
            'type_jumpurl' => '',
            'type_extend' => array(
                'class' => '',
                'area' => '',
                'lang' => '',
                'year' => '',
                'star' => '',
                'director' => '',
                'state' => '',
                'version' => ''
            )
        );
        if (!isset($data['type'][$apitype])) {
            return $this->error('类型数据不存在');
        }
        $r = $data['type'][$apitype];
        foreach ($r[0] as $key => $value) {
            if (isset($r[$value['type_id']])) {
                $typeData = Db::name('type')->where('type_name', $value['type_name'])->find();
                if (!empty($typeData)) {
                    $parentId = $typeData['type_id'];
                    $subCategories = $r[$value['type_id']];
                    foreach ($subCategories as $k => $v) {
                        $subTypeData = Db::name('type')->where('type_name', $v['type_name'])->find();
                        if (empty($subTypeData)) {
                            $typearr['type_pid'] = $parentId;
                            $typearr['type_name'] = $v['type_name'];
                            model('Type')->saveData($typearr);
                        }
                    }
                } else {
                    $typearr['type_pid'] = 0;
                    $typearr['type_name'] = $value['type_name'];
                    model('Type')->saveData($typearr);
                    $typeDatas = Db::name('type')->where('type_name', $value['type_name'])->find();
                    $parentIds = $typeDatas['type_id'];
                    $subCategories = $r[$value['type_id']];
                    foreach ($subCategories as $k => $v) {
                        $subTypeData = Db::name('type')->where('type_name', $v['type_name'])->find();

                        if (empty($subTypeData)) {
                            $typearr['type_pid'] = $parentIds;
                            $typearr['type_name'] = $v['type_name'];
                            model('Type')->saveData($typearr);
                        }
                    }
                }
            } else {
                $typearr['type_pid'] = 0;
                $typearr['type_name'] = $value['type_name'];
                model('Type')->saveData($typearr);
            }
        }
    }
    //文章
    public function intonews()
    {
        $data = $this->apidata();
        $typearr = array(
            'type_id' => '',
            'type_mid' => 2,
            'type_status' => 1,
            'type_sort' => '',
            'type_en' => '',
            'type_tpl' => 'type.html',
            'type_tpl_list' => 'show.html',
            'type_tpl_detail' => 'detail.html',
            'type_tpl_play' => '',
            'type_tpl_down' => '',
            'type_title' => '',
            'type_key' => '',
            'type_des' => '',
            'type_logo' => '',
            'type_pic' => '',
            'type_jumpurl' => '',
            'type_extend' => array(
                'class' => '',
                'area' => '',
                'lang' => '',
                'year' => '',
                'star' => '',
                'director' => '',
                'state' => '',
                'version' => ''
            )
        );
        if (!isset($data['news']['newstype'])) {
            return $this->error('类型数据不存在');
        }
        $r = $data['news']['newstype'];
         
        foreach ($r[0] as $key => $value) {
            if (isset($r[$value['type_id']])) {
                $typeData = Db::name('type')->where('type_name', $value['type_name'])->find();
                if (!empty($typeData)) {
                    $parentId = $typeData['type_id'];
                    $subCategories = $r[$value['type_id']];
                    foreach ($subCategories as $k => $v) {
                        $subTypeData = Db::name('type')->where('type_name', $v['type_name'])->find();
                        if (empty($subTypeData)) {
                            $typearr['type_pid'] = $parentId;
                            $typearr['type_name'] = $v['type_name'];
                            model('Type')->saveData($typearr);
                        }
                    }
                } else {
                    $typearr['type_pid'] = 0;
                    $typearr['type_name'] = $value['type_name'];
                    model('Type')->saveData($typearr);
                    $typeDatas = Db::name('type')->where('type_name', $value['type_name'])->find();
                    $parentIds = $typeDatas['type_id'];
                    $subCategories = $r[$value['type_id']];
                    foreach ($subCategories as $k => $v) {
                        $subTypeData = Db::name('type')->where('type_name', $v['type_name'])->find();

                        if (empty($subTypeData)) {
                            $typearr['type_pid'] = $parentIds;
                            $typearr['type_name'] = $v['type_name'];
                            model('Type')->saveData($typearr);
                        }
                    }
                }
            } else {
                $typearr['type_pid'] = 0;
                $typearr['type_name'] = $value['type_name'];
                model('Type')->saveData($typearr);
            }
        }
        
        $data = $this->apidata();
        $cjapi=$data['news']['api'];
        $cjflag = md5($cjapi); 
        $nname = '最新影视娱乐资讯采集';
        $name = '牛牛助手-影视资讯'; 
        //资源库
        $this->napi($name, $cjapi); 
        //绑定已有分类  
        $this->bindnews($data, $cjflag);
        //定时任务 
        $this->cron_news($cjflag, $name, $nname, $cjapi);
    }
    public function users()
    {
        $alltype = Db::name('type')->order('type_pid ASC, type_sort ASC, type_id ASC')->column('*', 'type_id');
        $groups = [
            [
                'group_id' => 1,
                'group_name' => "游客",
                'group_type' => [],
                'group_popedom' => []
            ],
            [
                'group_id' => 2,
                'group_name' => "默认会员",
                'group_type' => [],
                'group_popedom' => []
            ],
            [
                'group_id' => 3,
                'group_name' => "VIP会员",
                'group_type' => [],
                'group_popedom' => []
            ]
        ];
        foreach ($groups as &$group) {
            foreach ($alltype as $type) {
                $typeid = $type['type_id'];
                $group['group_type'][] = $typeid;
                $group['group_popedom'][$typeid] = [
                    '1' => 1,
                    '2' => 2,
                    '3' => 3,
                    '4' => 4,
                    '5' => 5
                ];
            }
            model('Group')->saveData($group);
        }
    }
    //播放器
    public function player($apiinfo, $name, $playurl)
    {
        $players = array(
            'status' => '1',
            'from' => "$apiinfo",
            'show' => $name,
            'des' => $name,
            'target' => '_self',
            'ps' => '1',
            'parse' => $playurl,
            'sort' => '1000',
            'tip' => '无需安装任何插件',
        );
        $playerfile =  APP_PATH . 'extra/vodplayer.php';
        $vodlist = require($playerfile);
        $vodlist[$apiinfo] = $players;
        mac_arr2file($playerfile, $vodlist);
        $code = "MacPlayer.Html='<iframe width=\"100%\" height=\"'+MacPlayer.Height+'\" src=\"" . $playurl . "'+MacPlayer.PlayUrl+'\" frameborder=\"0\" allowfullscreen=\"true\" border=\"0\" marginwidth=\"0\" marginheight=\"0\" scrolling=\"no\"></iframe>';MacPlayer.Show();";
        $js = fwrite(fopen(ROOT_PATH . "static/player/" . $apiinfo . ".js", "wb"), $code);
    }
    //采集接口
    public function napi($name, $cjapi)
    {
        $collect = array(
            'collect_name' => $name,
            'collect_url' => $cjapi,
            'collect_param' => '',
            'collect_type' => 2,
            'collect_mid' => 2,
            'collect_opt' => 0,
            'collect_filter' => 0,
            'collect_filter_from' => '',
            'collect_filter_year' => '',
            'collect_sync_pic_opt' => 0,
        );
        $dbcollect = Db::name('collect')
            ->where('collect_url', $cjapi)
            ->find();
        if (empty($dbcollect)) {
            model('Collect')->saveData($collect);
        }
    }
     public function capi($name, $cjapi)
    {
        $collect = array(
            'collect_name' => $name,
            'collect_url' => $cjapi,
            'collect_param' => '',
            'collect_type' => 2,
            'collect_mid' => 1,
            'collect_opt' => 0,
            'collect_filter' => 0,
            'collect_filter_from' => '',
            'collect_filter_year' => '',
            'collect_sync_pic_opt' => 0,
        );
        $dbcollect = Db::name('collect')
            ->where('collect_url', $cjapi)
            ->find();
        if (empty($dbcollect)) {
            model('Collect')->saveData($collect);
        }
    }
    public function bind($data, $apiinfo,$cjflag)
    {
        if (isset($data['restype'][$apiinfo])) {
            $type_list = model('Type')->getCache('type_list');
            $apilists = $data['restype'][$apiinfo];
            $arrlist = arrlist_key_values($apilists, 'type_id', 'type_name');
            $typelist = arrlist_key_values($type_list, 'type_name', 'type_id');
            $bindfile = APP_PATH . 'extra/bind.php';
            $bindlist = require($bindfile);
            foreach ($arrlist as $key => $value) {
                if (!empty($typelist[$value])) {
                    $col = $cjflag . "_" . $key;
                    $val = $typelist[$value];
                    $bindlist[$col] = intval($val);
                }
            }
            mac_arr2file($bindfile, $bindlist);
        }
    }
    
    public function bindnews($data, $cjflag)
    {
        if (isset($data['news']['type'])) {
            $type_list = model('Type')->getCache('type_list');
            $apilists = $data['news']['type'];
            $arrlist = arrlist_key_values($apilists, 'type_id', 'type_name');
            $typelist = arrlist_key_values($type_list, 'type_name', 'type_id');
            $bindfile = APP_PATH . 'extra/bind.php';
            $bindlist = require($bindfile);
            foreach ($arrlist as $key => $value) {
                if (!empty($typelist[$value])) {
                    $col = $cjflag . "_" . $key;
                    $val = $typelist[$value];
                    $bindlist[$col] = intval($val);
                }
            }
            mac_arr2file($bindfile, $bindlist);
        }
    }
    public function cron($cjflag, $name, $nname, $cjapi)
    {
        $list = config('timming');
        $list[$name] = array(
            
            'id' => $name,
            'status' => '1',
            'name' => $name,
            'des' => '当日采集：' . $name . '【' . $nname . '】',
            'file' => 'collect',
            'param' => 'ac=cj&h=24&cjflag=' . $cjflag . '&cjurl=' . $cjapi,
            'weeks' => '1,2,3,4,5,6,0',
            'hours' => '00,01,02,03,04,05,06,07,08,09,10,11,12,13,14,15,16,17,18,19,20,21,22,23',

        );
        mac_arr2file(APP_PATH . 'extra/timming.php', $list);
    }
    public function cron_news($cjflag, $name, $nname, $cjapi)
    {
        $list = config('timming');
        $list[$name] = array(
            
            'id' => $name,
            'status' => '1',
            'name' => $name,
            'des' => '当日采集：' . $name . '【' . $nname . '】',
            'file' => 'collect',
            'param' => 'ac=cj&h=24&cjflag=' . $cjflag . '&cjurl=' . $cjapi.'&type=2&mid=2',
            'weeks' => '1,2,3,4,5,6,0',
            'hours' => '00,01,02,03,04,05,06,07,08,09,10,11,12,13,14,15,16,17,18,19,20,21,22,23',

        );
        mac_arr2file(APP_PATH . 'extra/timming.php', $list);
    }
    public function install()
    {
        if (Request()->isPost()) {
            $param = input();
            $password = $param['password'];
            $siteid = md5($password);
            $auth_key = mac_get_rndstr(24);
            $apiconf = include(ROOT_PATH . 'niuniuzs/conf/nnzs.php');
            $apiurl = $apiconf['url'];
            $confpath = ROOT_PATH . 'niuniuzs/conf/conf.php';
            copy(ROOT_PATH . 'niuniuzs/conf/conf.default.php', $confpath);
            chmod($confpath, 0755);
            $conf = include($confpath);
            $replace = array();
            $replace['auth_key'] = $auth_key;
            $replace['siteid'] = $siteid;
            $replace['domian'] = $_SERVER['HTTP_HOST'];
            $replace['http'] = $_SERVER['REQUEST_SCHEME'];
            $replace['sitename'] = $GLOBALS['config']['site']['site_name'];
            $replace['serverip'] = $_SERVER['SERVER_ADDR'];
            $replace['type'] = "install";
            file_replace_var($confpath, $replace);
            $json = https_request($apiurl.'/?macinstall', $replace, '', 500, 1);
            $this->initialize();
            $data = $this->apidata();
            $apilist = $data['apilist'];
            $creat_type = $param['type']; //0 不导入 1、导入 v 2 导入X
            $clear_type = $param['clear']; //0 不清空  1、清空 
            $api = $param['api']; //0 自动  1、手动  
            $play = $param['play']; //0 自动  1、手动  
            $cron = $param['cron']; //0 自动  1、手动 
            $users = $param['users']; //0 自动  1、手动  会员权限 
            $bind = $param['bind'];
            if ($clear_type == 1) {
                Db::execute('TRUNCATE TABLE ' . config('database.prefix') . 'type');
            }
            //导入分类
            if ($creat_type != 0) {
                $apitype = ($creat_type == 1) ? 'v' : 'x';
                $this->into($apitype);
            }
            //会员权限 
            if ($users == 1) {
                $this->users();
            }
            //资源库 定时任务  播放器  自动分类
            foreach ($apilist as &$_api) {
                $name = $_api['name'];
                $cjapi = $_api['api'];
                $cjflag = md5($cjapi);
                $apiinfo = $_api['apiinfo'];
                $playurl = $_api['play'];
                $nname = $_api['newname'];
                //自动添加采集接口
                if ($api == 0) {
                    $this->capi($name, $cjapi);
                }
                //播放器 
                if ($play == 0) {
                    $this->player($apiinfo, $name, $playurl);
                }
                //绑定已有分类 
                if ($bind == 0) {
                    $this->bind($data, $apiinfo,$cjflag);
                }
                //定时任务
                if ($cron == 0) {
                    $this->cron($cjflag, $name, $nname, $cjapi);
                }
            }
            return $this->success('安装成功', 'auto/index');
        } else {
            is_file(ROOT_PATH.'niuniuzs/conf/conf.php') AND  $this->success('以安装请勿重复安装', 'auto/index');
            return $this->fetch(ROOT_PATH . '/niuniuzs/view/html/install.htm');
        }
    }

    public function index()
    {
        $data = $this->apidata();
        foreach ($data as $key => $value) {
            $this->assign($key, $value);
        }
        if (is_file(ROOT_PATH.'niuniuzs/conf/conf.php')) {
            return $this->fetch(ROOT_PATH . '/niuniuzs/view/html/index.htm');
         } else {
            return $this->fetch(ROOT_PATH . '/niuniuzs/view/html/install.htm');
        }
    }
    public function zyk()
    {
    
        $data = $this->apidata();
         
        foreach ($data as $key => $value) {
            $this->assign($key, $value);
        }
        return $this->fetch(ROOT_PATH . '/niuniuzs/view/html/zyk.htm');
    }
    public function rvm()
    {
        $data = $this->apidata();
        foreach ($data as $key => $value) {
            $this->assign($key, $value);
        }
        return $this->fetch(ROOT_PATH . '/niuniuzs/view/html/rvm.htm');
    }
    public function rep()
    {

        $data = $this->apidata();
       
        foreach ($data as $key => $value) {
            $this->assign($key, $value);
        }
        return $this->fetch(ROOT_PATH . '/niuniuzs/view/html/rep.htm');
    }
    public function free()
    {

        $data = $this->apidata();
        foreach ($data as $key => $value) {
            $this->assign($key, $value);
        }
        return $this->fetch(ROOT_PATH . '/niuniuzs/view/html/free.htm');
    }
     public function crons()
    {

        $data = $this->apidata();
        foreach ($data as $key => $value) {
            $this->assign($key, $value);
        }
        return $this->fetch(ROOT_PATH . '/niuniuzs/view/html/cron.htm');
    }
    public function poster()
    {
        $data = $this->apidata();
        foreach ($data as $key => $value) {
            $this->assign($key, $value);
        }
        return $this->fetch(ROOT_PATH . '/niuniuzs/view/html/poster.htm');
    }
    //自动海报
    public function autoposter()
{
    $data = $this->apidata();
    $param = input();
    $v = $param['mode'];
    $levl = $param['levl'];
    $num = 0;
    foreach ($data['hb'][$v] as $key => $value) {
        $dbid = $value['dbid'];
        $image_url = $value['image_url'];
        $sql="update mac_vod set vod_pic_slide='$image_url' , vod_level=$levl where  vod_douban_id=$dbid";
        $result = Db::execute($sql); 
        if ($result > 0) {
            $num++;
        }
    }
    $msg = "自动更新了 $num 条到推荐等级 $levl";
    return $this->success($msg, 'auto/poster');
}
  
    public function news()
    {
        $data = $this->apidata();
        foreach ($data as $key => $value) {
            $this->assign($key, $value);
        }
        $view_path=config('template.view_path');
        $artpath=ROOT_PATH .$view_path.'art/'; 
        $this->assign('artpath', $artpath); 
        
        return $this->fetch(ROOT_PATH . '/niuniuzs/view/html/news.htm');
    }
    

    public function cleartype()
    {
        Db::execute('TRUNCATE TABLE ' . config('database.prefix') . 'type');
        return $this->success('清空所有分类成功', 'auto/zyk');
    }
    public function intov()
    {
        $this->into('v');
        return $this->success('添加影视分类成功', 'auto/zyk');
    }

    public function intox()
    {
        $this->into('x');
        return $this->success('添加x分类成功', 'auto/zyk');
    }
     public function inton()
    {
        $this->intonews();
        return $this->success('添加分类 自动绑定 定时任务设置成功', 'auto/news');
    }
    public function update()
    {
        $param = input();
        $v = $param['to'];
         $apiconf = include(ROOT_PATH . 'niuniuzs/conf/nnzs.php'); 
         $rq = $apiconf['url'].'/update/'; 
        echo $this->fetch("admin@public/head");
        echo "<div class='update'><h1>在线升级中,请稍后......</h1><textarea rows=\"10\" class='layui-textarea' readonly>正在下载升级文件包...\n";
        ob_flush();
        flush();
        sleep(1);
        $save_path = ROOT_PATH . "application/data/update/" . $v . ".zip";
        $downurl = $rq . $v . ".zip";
        $zip = mac_curl_gets($downurl);
        @fwrite(@fopen($save_path, "wb"), $zip);
        if (!is_file($save_path)) {
            echo "下载升级包失败，请重试...\n";
            exit;
        }
        if (filesize($save_path) < 1) {
            @unlink($save_path);
            echo "下载升级包失败，请重试...\n";
            exit;
        }
        echo "下载升级包完毕...\n";
        echo "正在处理升级包的文件...\n";
        ob_flush();
        flush();
        sleep(1);
        $zipfile = new PclZip();
        $zipfile->PclZip($save_path);
        if (!$zipfile->extract(PCLZIP_OPT_PATH, '', PCLZIP_OPT_REPLACE_NEWER)) {
            echo $zipfile->error_string . "\n";
            echo "升级失败，请检查系统目录及文件权限！" . "\n";
            exit;
        }
        @unlink($save_path);
        $this->_cache_clear();
        echo "更新数据缓存文件...\n";
        ob_flush();
        flush();
        echo "</textarea></div>";
        echo "<script type=\"text/javascript\">layui.use([\"jquery\",\"layer\"],function(){var layer=layui.layer,\$=layui.jquery;setTimeout(function(){var index=parent.layer.getFrameIndex(window.name);parent.location.reload();parent.layer.close(index)},\"6000\")});</script>";
    }

    public function  artcp(){
    $view_path = config('template.view_path');
    $artpath = ROOT_PATH . $view_path . 'art/';
    $macstaticpath = ROOT_PATH . 'static/art/';
    $zspath = ROOT_PATH . 'niuniuzs/view/art/';
    $zsthemepath = ROOT_PATH . 'niuniuzs/art/';
    if (!is_dir($artpath)) {
        mkdir($artpath, 0755, true);
        chmod($artpath, 0755);
        copy_recusive($zspath, $macstaticpath);
        chmod($macstaticpath, 0755);
    }
    $typePath = $artpath . 'type.html';
    $detailPath = $artpath . 'detail.html';
    if (!file_exists($typePath)) {
        if (file_exists($zsthemepath . 'type.html')) {
            auto_copy($zsthemepath . 'type.html', $typePath);
            chmod($typePath, 0755);
            copy_recusive($zspath, $macstaticpath);
            chmod($macstaticpath, 0755);
        }
    }
    if (!file_exists($detailPath)) {
        if (file_exists($zsthemepath . 'detail.html')) {
            auto_copy($zsthemepath . 'detail.html', $detailPath);
            chmod($detailPath, 0755);
            copy_recusive($zspath, $macstaticpath);
            chmod($macstaticpath, 0755);
        }
    }
     $msg = "资讯模板初始化完成";
        return $this->success($msg, 'auto/news');
    }
    
    public function autotype()
    {
        $data = $this->apidata();
        $cjflag = input('cjflag');
        $cjapi = input('cjurl');
        $nname = input('cname');
        $name = input('name');
        $apiinfo = input('apiinfo');
        $playurl = input('playurl');
        //资源库
        $this->capi($name, $cjapi);
        //播放器  
        $this->player($apiinfo, $name, $playurl);
        //绑定已有分类  
        $this->bind($data, $apiinfo,$cjflag);
        //定时任务 
        $this->cron($cjflag, $name, $nname, $cjapi);
        $msg = "一键添加解析/自动分类(未创建不绑定)/定时任务成功";
        return $this->success($msg, 'auto/zyk');
    }
}
