<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class Scalz_Plugin_Installer {
    private static array $plugins = [ 'rankmath' => 'seo-by-rankmath/seo-by-rankmath.php', 'acf' => 'advanced-custom-fields/acf.php', 'ai_engine' => 'ai-engine/ai-engine.php' ];
    private static array $slugs   = [ 'rankmath' => 'seo-by-rankmath', 'acf' => 'advanced-custom-fields', 'ai_engine' => 'ai-engine' ];

    public static function install( string $plugin_key ): array {
        if ( ! isset( self::$plugins[ $plugin_key ] ) ) return [ 'error' => "Unknown plugin: {$plugin_key}" ];
        $file = self::$plugins[ $plugin_key ];
        if ( is_plugin_active( $file ) ) return [ 'success' => true, 'message' => 'Already active' ];
        if ( file_exists( WP_PLUGIN_DIR . '/' . $file ) ) {
            $r = activate_plugin( $file );
            return is_wp_error( $r ) ? [ 'error' => $r->get_error_message() ] : [ 'success' => true, 'message' => 'Activated' ];
        }
        include_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        include_once ABSPATH . 'wp-admin/includes/plugin-install.php';
        $api = plugins_api( 'plugin_information', [ 'slug' => self::$slugs[ $plugin_key ], 'fields' => [ 'download_link' => true ] ] );
        if ( is_wp_error( $api ) ) return [ 'error' => 'WP.org API: ' . $api->get_error_message() ];
        $upgrader = new Plugin_Upgrader( new WP_Ajax_Upgrader_Skin() );
        $installed = $upgrader->install( $api->download_link );
        if ( is_wp_error( $installed ) ) return [ 'error' => $installed->get_error_message() ];
        if ( ! $installed ) return [ 'error' => 'Installation failed' ];
        $r = activate_plugin( $file );
        return is_wp_error( $r ) ? [ 'error' => 'Installed but activation failed: ' . $r->get_error_message() ] : [ 'success' => true, 'message' => 'Installed and activated' ];
    }
}
