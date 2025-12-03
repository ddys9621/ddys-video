<?php

namespace app\api\controller;

use think\Controller;
use think\Cookie;
use think\Db;
use app\common\util\PclZip;
use app\common\util\Dir;

include ROOT_PATH . 'niuniuzs/func/func.php';
class Auto extends Base
{
    public function __construct()
    {
        parent::__construct();
    } 
    public function test(){
        $param = input();
        $tokarr= include(ROOT_PATH . 'niuniuzs/conf/conf.php');
        $tok=$tokarr['auth_key'];
        $token = $param['token'];
        if (($token == $tok)) {
            echo "ok";  
        }else{
            echo "token-err";  
        }
    } 
       
     public function replace(){
       $pre = config('database.prefix'); 
        $param = input();
        $tokarr= include(ROOT_PATH . 'niuniuzs/conf/conf.php');
        $tok=$tokarr['auth_key'];
        $token = $param['token'];
        $type = $param['types'];
        $old=$param['old'];
        $new=$param['new']; 
         if (($token == $tok)) {
             echo 'ok';
             if ($type=='img') {
                 $sql = 'UPDATE ' . $pre . 'vod SET vod_pic=REPLACE(vod_pic, "' . $old . '", "' . $new . '")'; 
                 $upres = Db::execute($sql);
                 echo "--replace img--$upres--";
             }
             if ($type=='play') {
                 $sql = 'UPDATE ' . $pre . 'vod SET vod_play_url=REPLACE(vod_play_url, "' . $old . '", "' . $new . '")';
                 $upres = Db::execute($sql); 
                 echo "--replace play_url--$upres条";
             }
         }else{
             echo "token-err"; 
         }
    } 
     public function update()
    { 
        $param = input();
        $tokarr= include(ROOT_PATH . 'niuniuzs/conf/conf.php');
        $tok=$tokarr['auth_key'];
        $token = $param['token'];
        if ($token==$tok) { 
        $list = config('timming');
        $list=arrlist_cond_orderby($list, $cond = array('status'=>1,'file'=>"collect"), $orderby = array(), $page = 1, $pagesize = 100);
        foreach ($list as $key => $value) { 
                $hosturl=$GLOBALS['_SERVER']['HTTP_HOST'];
                //想要使用ip域名访问的请打开注释把8111端口换成自己网站的
                //$hosturl=$GLOBALS['_SERVER']['HTTP_HOST'].":8111";
                $apiuri="/api.php/timming/index.html?enforce=1&name=".rawurlencode($value['name']);
                $curi=$hosturl.$apiuri; 
                $res=mac_curl_get($curi);
                echo $res;
             
        }} else {
            echo "err";
        }
    }
    
    
}
